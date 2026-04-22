// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Reputation
 * @notice On-chain agent reputation scoring for the AgentMesh marketplace.
 * @dev Tracks completed/failed tasks, total earnings, and a composite score.
 *      Only the linked escrow contract can update reputations (trustless).
 *
 *      Scoring: +10 per success (with reliability bonus), -15 per failure.
 */
contract Reputation is Ownable {

    // ──────────────────── Types ────────────────────

    struct AgentStats {
        uint256 completedTasks;
        uint256 failedTasks;
        uint256 totalEarned;      // cumulative USDC earned (6 decimals)
        int256  score;            // reputation score
        uint256 registeredAt;
        bool    registered;
    }

    // ──────────────────── State ────────────────────

    address public escrow;

    mapping(address => AgentStats) public agents;
    address[] public agentList;

    // ──────────────────── Events ────────────────────

    event AgentRegistered(address indexed agent, uint256 timestamp);
    event TaskSuccess(address indexed agent, uint256 earned, int256 newScore);
    event TaskFailure(address indexed agent, int256 newScore);

    // ──────────────────── Constructor ────────────────────

    constructor(address _owner) Ownable(_owner) {}

    // ──────────────────── Admin ────────────────────

    function setEscrow(address _escrow) external onlyOwner {
        require(_escrow != address(0), "Reputation: zero escrow");
        escrow = _escrow;
    }

    // ──────────────────── Registration ────────────────────

    /**
     * @notice Register a new agent in the reputation system.
     *         Anyone can call this (agents self-register).
     */
    function registerAgent(address agent) external {
        require(!agents[agent].registered, "Reputation: already registered");

        agents[agent] = AgentStats({
            completedTasks: 0,
            failedTasks: 0,
            totalEarned: 0,
            score: 0,
            registeredAt: block.timestamp,
            registered: true
        });
        agentList.push(agent);

        emit AgentRegistered(agent, block.timestamp);
    }

    // ──────────────────── Score Updates ────────────────────

    /**
     * @notice Record a successful task completion. Called by escrow only.
     *         Score: +10 base + reliability bonus (+1 per 5 completions).
     */
    function recordSuccess(address agent, uint256 earned) external {
        require(msg.sender == escrow, "Reputation: only escrow");
        AgentStats storage stats = agents[agent];
        require(stats.registered, "Reputation: not registered");

        stats.completedTasks++;
        stats.totalEarned += earned;

        int256 bonus = int256(stats.completedTasks / 5);
        stats.score += 10 + bonus;

        emit TaskSuccess(agent, earned, stats.score);
    }

    /**
     * @notice Record a failed task. Called by escrow only.
     *         Score: -15 (failures penalized more than successes).
     */
    function recordFailure(address agent) external {
        require(msg.sender == escrow, "Reputation: only escrow");
        AgentStats storage stats = agents[agent];
        require(stats.registered, "Reputation: not registered");

        stats.failedTasks++;
        stats.score -= 15;

        emit TaskFailure(agent, stats.score);
    }

    // ──────────────────── Views ────────────────────

    function getReputation(address agent) external view returns (AgentStats memory) {
        return agents[agent];
    }

    function meetsThreshold(address agent, int256 minScore) external view returns (bool) {
        return agents[agent].registered && agents[agent].score >= minScore;
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    function getAllAgents() external view returns (address[] memory) {
        return agentList;
    }
}
