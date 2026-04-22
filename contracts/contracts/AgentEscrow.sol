// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentEscrow
 * @notice Trustless USDC escrow for agent task settlement on Arc.
 * @dev Holds bounty USDC during task execution. Releases to executor on
 *      successful validation, or refunds to poster on cancellation.
 *
 *      Integrated with TaskRegistry (marks tasks complete) and
 *      Reputation (records success/failure).
 */
contract AgentEscrow is Ownable {
    using SafeERC20 for IERC20;

    // ──────────────────── Types ────────────────────

    struct EscrowEntry {
        address poster;
        address assignee;
        uint256 amount;
        bool    settled;
    }

    // ──────────────────── State ────────────────────

    IERC20  public immutable usdc;
    address public taskRegistry;
    address public reputation;
    address public validator;

    mapping(uint256 => EscrowEntry) public escrows;
    uint256 public totalLocked;

    // ──────────────────── Events ────────────────────

    event EscrowRecorded(uint256 indexed taskId, address indexed poster, uint256 amount);
    event AssigneeSet(uint256 indexed taskId, address indexed assignee);
    event EscrowReleased(uint256 indexed taskId, address indexed assignee, uint256 amount);
    event EscrowRefunded(uint256 indexed taskId, address indexed poster, uint256 amount);

    // ──────────────────── Modifiers ────────────────────

    modifier onlyValidator() {
        require(msg.sender == validator, "AgentEscrow: only validator");
        _;
    }

    modifier onlyTaskRegistry() {
        require(msg.sender == taskRegistry, "AgentEscrow: only taskRegistry");
        _;
    }

    // ──────────────────── Constructor ────────────────────

    /**
     * @param _usdc      USDC on Arc Testnet (0x360000...0000)
     * @param _validator Address authorized to approve/reject task output
     * @param _owner     Admin for linking other contracts
     */
    constructor(address _usdc, address _validator, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "AgentEscrow: zero USDC");
        require(_validator != address(0), "AgentEscrow: zero validator");
        usdc = IERC20(_usdc);
        validator = _validator;
    }

    // ──────────────────── Admin ────────────────────

    function setTaskRegistry(address _taskRegistry) external onlyOwner {
        require(_taskRegistry != address(0), "AgentEscrow: zero address");
        taskRegistry = _taskRegistry;
    }

    function setReputation(address _reputation) external onlyOwner {
        require(_reputation != address(0), "AgentEscrow: zero address");
        reputation = _reputation;
    }

    function setValidator(address _validator) external onlyOwner {
        require(_validator != address(0), "AgentEscrow: zero address");
        validator = _validator;
    }

    // ──────────────────── Escrow Lifecycle ────────────────────

    /**
     * @notice Record an escrow entry when USDC arrives from TaskRegistry.createTask().
     * @dev Called by the backend after task creation. The USDC is already in this contract
     *      because TaskRegistry.createTask() transfers it here via safeTransferFrom.
     */
    function recordEscrow(uint256 taskId, address poster, uint256 amount) external {
        require(escrows[taskId].amount == 0, "AgentEscrow: exists");
        require(amount > 0, "AgentEscrow: zero amount");

        escrows[taskId] = EscrowEntry({
            poster: poster,
            assignee: address(0),
            amount: amount,
            settled: false
        });
        totalLocked += amount;

        emit EscrowRecorded(taskId, poster, amount);
    }

    /**
     * @notice Set the assignee when a task is assigned.
     */
    function setAssignee(uint256 taskId, address assignee) external {
        EscrowEntry storage entry = escrows[taskId];
        require(entry.amount > 0, "AgentEscrow: no escrow");
        require(entry.assignee == address(0), "AgentEscrow: already assigned");
        require(assignee != address(0), "AgentEscrow: zero assignee");

        entry.assignee = assignee;

        emit AssigneeSet(taskId, assignee);
    }

    /**
     * @notice Release escrowed USDC to the task executor after validation passes.
     * @dev Only callable by the validator. Also marks the task as completed in TaskRegistry
     *      and records success in Reputation.
     */
    function releaseToExecutor(uint256 taskId) external onlyValidator {
        EscrowEntry storage entry = escrows[taskId];
        require(!entry.settled, "AgentEscrow: already settled");
        require(entry.assignee != address(0), "AgentEscrow: no assignee");

        entry.settled = true;
        totalLocked -= entry.amount;

        // Transfer USDC to executor
        usdc.safeTransfer(entry.assignee, entry.amount);

        // Mark task completed in registry
        if (taskRegistry != address(0)) {
            ITaskRegistry(taskRegistry).markCompleted(taskId);
        }

        // Record success in reputation
        if (reputation != address(0)) {
            IReputation(reputation).recordSuccess(entry.assignee, entry.amount);
        }

        emit EscrowReleased(taskId, entry.assignee, entry.amount);
    }

    /**
     * @notice Refund escrowed USDC to the poster (cancellation or failure).
     */
    function refundToPoster(uint256 taskId) external {
        EscrowEntry storage entry = escrows[taskId];
        require(!entry.settled, "AgentEscrow: already settled");
        require(
            msg.sender == entry.poster || msg.sender == validator || msg.sender == owner(),
            "AgentEscrow: not authorized"
        );

        entry.settled = true;
        totalLocked -= entry.amount;

        usdc.safeTransfer(entry.poster, entry.amount);

        // Record failure if there was an assignee
        if (reputation != address(0) && entry.assignee != address(0)) {
            IReputation(reputation).recordFailure(entry.assignee);
        }

        emit EscrowRefunded(taskId, entry.poster, entry.amount);
    }

    // ──────────────────── Views ────────────────────

    function getEscrow(uint256 taskId) external view returns (
        address poster, address assignee, uint256 amount, bool settled
    ) {
        EscrowEntry storage e = escrows[taskId];
        return (e.poster, e.assignee, e.amount, e.settled);
    }
}

// ──────────────────── Interfaces ────────────────────

interface ITaskRegistry {
    function markCompleted(uint256 taskId) external;
}

interface IReputation {
    function recordSuccess(address agent, uint256 earned) external;
    function recordFailure(address agent) external;
}
