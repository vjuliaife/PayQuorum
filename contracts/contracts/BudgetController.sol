// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BudgetController
 * @notice On-chain spending limits for autonomous agents.
 * @dev Prevents runaway agent spending — a critical safety mechanism.
 *      Enforces per-agent daily limits and per-task caps.
 *
 *      The admin (treasury agent or deployer) configures budgets.
 *      Any contract or backend can call canSpend() to check before authorizing.
 *      recordSpending() reverts if the spend exceeds configured limits.
 */
contract BudgetController is Ownable {

    // ──────────────────── Types ────────────────────

    struct BudgetConfig {
        uint256 dailyLimit;       // max USDC per 24h period (6 decimals)
        uint256 perTaskLimit;     // max USDC per single task (0 = no limit)
        uint256 totalSpent;       // all-time spending
        uint256 dailySpent;       // spending in current period
        uint256 periodStart;      // start of current daily period
        bool    configured;
    }

    // ──────────────────── State ────────────────────

    mapping(address => BudgetConfig) public budgets;

    // ──────────────────── Events ────────────────────

    event BudgetConfigured(address indexed agent, uint256 dailyLimit, uint256 perTaskLimit);
    event SpendingRecorded(address indexed agent, uint256 amount, uint256 dailySpent, uint256 dailyLimit);
    event PeriodReset(address indexed agent, uint256 newPeriodStart);

    // ──────────────────── Constructor ────────────────────

    constructor(address _owner) Ownable(_owner) {}

    // ──────────────────── Configuration ────────────────────

    /**
     * @notice Configure spending limits for an agent. Only owner (admin/treasury).
     */
    function configureBudget(
        address agent,
        uint256 dailyLimit,
        uint256 perTaskLimit
    ) external onlyOwner {
        require(dailyLimit > 0, "BudgetController: zero daily limit");

        BudgetConfig storage config = budgets[agent];
        config.dailyLimit = dailyLimit;
        config.perTaskLimit = perTaskLimit;
        config.configured = true;

        if (config.periodStart == 0) {
            config.periodStart = block.timestamp;
        }

        emit BudgetConfigured(agent, dailyLimit, perTaskLimit);
    }

    // ──────────────────── Spending ────────────────────

    /**
     * @notice Check if an agent can spend a given amount.
     */
    function canSpend(address agent, uint256 amount) external view returns (bool) {
        BudgetConfig storage config = budgets[agent];
        if (!config.configured) return false;

        if (config.perTaskLimit > 0 && amount > config.perTaskLimit) return false;

        uint256 dailySpent = config.dailySpent;
        if (block.timestamp >= config.periodStart + 1 days) {
            dailySpent = 0;
        }

        return dailySpent + amount <= config.dailyLimit;
    }

    /**
     * @notice Record spending. Reverts if budget would be exceeded.
     */
    function recordSpending(address agent, uint256 amount) external {
        BudgetConfig storage config = budgets[agent];
        require(config.configured, "BudgetController: not configured");

        require(
            config.perTaskLimit == 0 || amount <= config.perTaskLimit,
            "BudgetController: exceeds per-task limit"
        );

        if (block.timestamp >= config.periodStart + 1 days) {
            config.dailySpent = 0;
            config.periodStart = block.timestamp;
            emit PeriodReset(agent, block.timestamp);
        }

        require(
            config.dailySpent + amount <= config.dailyLimit,
            "BudgetController: exceeds daily limit"
        );

        config.dailySpent += amount;
        config.totalSpent += amount;

        emit SpendingRecorded(agent, amount, config.dailySpent, config.dailyLimit);
    }

    // ──────────────────── Views ────────────────────

    function remainingDailyBudget(address agent) external view returns (uint256) {
        BudgetConfig storage config = budgets[agent];
        if (!config.configured) return 0;

        uint256 dailySpent = config.dailySpent;
        if (block.timestamp >= config.periodStart + 1 days) {
            dailySpent = 0;
        }

        if (dailySpent >= config.dailyLimit) return 0;
        return config.dailyLimit - dailySpent;
    }

    function getBudget(address agent) external view returns (BudgetConfig memory) {
        return budgets[agent];
    }
}
