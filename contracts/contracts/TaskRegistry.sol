// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TaskRegistry
 * @notice On-chain task marketplace for autonomous agents on Arc.
 * @dev Agents post tasks with USDC bounties. Other agents bid and get assigned.
 *      USDC bounties are transferred to the linked AgentEscrow on task creation.
 *
 *      Arc Testnet USDC address: 0x3600000000000000000000000000000000000000
 */
contract TaskRegistry is Ownable {
    using SafeERC20 for IERC20;

    // ──────────────────── Types ────────────────────

    enum TaskStatus { Open, Assigned, Completed, Cancelled }

    struct Task {
        uint256 id;
        address poster;
        string  description;
        uint256 bounty;          // USDC 6-decimal amount
        TaskStatus status;
        address assignee;
        uint256 createdAt;
        uint256 completedAt;
    }

    struct Bid {
        address bidder;
        uint256 price;           // proposed USDC price
        string  proposal;
        uint256 timestamp;
    }

    // ──────────────────── State ────────────────────

    IERC20  public immutable usdc;
    address public escrow;

    uint256 public nextTaskId;
    mapping(uint256 => Task)   public tasks;
    mapping(uint256 => Bid[])  internal _bids;
    mapping(uint256 => mapping(address => bool)) public hasBid;

    // ──────────────────── Events ────────────────────

    event TaskCreated(uint256 indexed taskId, address indexed poster, uint256 bounty, string description);
    event BidPlaced(uint256 indexed taskId, address indexed bidder, uint256 price);
    event TaskAssigned(uint256 indexed taskId, address indexed assignee, uint256 agreedPrice);
    event TaskCompleted(uint256 indexed taskId, address indexed assignee, uint256 timestamp);
    event TaskCancelled(uint256 indexed taskId);
    event EscrowUpdated(address indexed oldEscrow, address indexed newEscrow);

    // ──────────────────── Constructor ────────────────────

    /**
     * @param _usdc  USDC ERC-20 address on Arc Testnet
     *               (0x3600000000000000000000000000000000000000)
     * @param _owner Admin address that can update the escrow link
     */
    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "TaskRegistry: zero USDC address");
        usdc = IERC20(_usdc);
    }

    // ──────────────────── Admin ────────────────────

    /**
     * @notice Link the AgentEscrow contract. Can only be set once unless updated by owner.
     */
    function setEscrow(address _escrow) external onlyOwner {
        require(_escrow != address(0), "TaskRegistry: zero escrow");
        address old = escrow;
        escrow = _escrow;
        emit EscrowUpdated(old, _escrow);
    }

    // ──────────────────── Task Lifecycle ────────────────────

    /**
     * @notice Post a new task. Caller must have approved this contract for `bounty` USDC.
     *         Bounty is immediately transferred to the escrow contract.
     */
    function createTask(string calldata description, uint256 bounty) external returns (uint256 taskId) {
        require(escrow != address(0), "TaskRegistry: escrow not set");
        require(bounty > 0, "TaskRegistry: zero bounty");

        taskId = nextTaskId++;
        tasks[taskId] = Task({
            id: taskId,
            poster: msg.sender,
            description: description,
            bounty: bounty,
            status: TaskStatus.Open,
            assignee: address(0),
            createdAt: block.timestamp,
            completedAt: 0
        });

        usdc.safeTransferFrom(msg.sender, escrow, bounty);

        emit TaskCreated(taskId, msg.sender, bounty, description);
    }

    /**
     * @notice Place a bid on an open task.
     */
    function placeBid(uint256 taskId, uint256 price, string calldata proposal) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "TaskRegistry: not open");
        require(!hasBid[taskId][msg.sender], "TaskRegistry: already bid");
        require(price <= task.bounty, "TaskRegistry: price exceeds bounty");

        _bids[taskId].push(Bid({
            bidder: msg.sender,
            price: price,
            proposal: proposal,
            timestamp: block.timestamp
        }));
        hasBid[taskId][msg.sender] = true;

        emit BidPlaced(taskId, msg.sender, price);
    }

    /**
     * @notice Task poster selects a winning bidder.
     */
    function assignTask(uint256 taskId, address assignee) external {
        Task storage task = tasks[taskId];
        require(msg.sender == task.poster, "TaskRegistry: not poster");
        require(task.status == TaskStatus.Open, "TaskRegistry: not open");
        require(hasBid[taskId][assignee], "TaskRegistry: no bid from assignee");

        task.status = TaskStatus.Assigned;
        task.assignee = assignee;

        emit TaskAssigned(taskId, assignee, task.bounty);
    }

    /**
     * @notice Mark task as completed. Only callable by the escrow contract
     *         after the validator approves the work.
     */
    function markCompleted(uint256 taskId) external {
        require(msg.sender == escrow, "TaskRegistry: only escrow");
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Assigned, "TaskRegistry: not assigned");

        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;

        emit TaskCompleted(taskId, task.assignee, block.timestamp);
    }

    /**
     * @notice Cancel an open task. Only the poster can cancel.
     *         Refund handled by the escrow contract separately.
     */
    function cancelTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(msg.sender == task.poster, "TaskRegistry: not poster");
        require(task.status == TaskStatus.Open, "TaskRegistry: not open");

        task.status = TaskStatus.Cancelled;

        emit TaskCancelled(taskId);
    }

    // ──────────────────── Views ────────────────────

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getBids(uint256 taskId) external view returns (Bid[] memory) {
        return _bids[taskId];
    }

    function getBidCount(uint256 taskId) external view returns (uint256) {
        return _bids[taskId].length;
    }
}
