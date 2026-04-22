import { ethers } from "hardhat";

/**
 * Deploy all AgentMesh contracts to Arc Testnet.
 *
 * Prerequisites:
 *   1. Fund deployer wallet with testnet USDC from https://faucet.circle.com
 *   2. Set DEPLOYER_PRIVATE_KEY in .env
 *   3. Set USDC_ADDRESS=0x3600000000000000000000000000000000000000
 *   4. Optionally set VALIDATOR_ADDRESS (defaults to deployer)
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network arcTestnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatUnits(balance, 18), "USDC (native 18-dec)\n");

  const USDC = process.env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000";
  const VALIDATOR = process.env.VALIDATOR_ADDRESS || deployer.address;

  // 1. AgentEscrow
  console.log("1/4 Deploying AgentEscrow...");
  const AgentEscrow = await ethers.getContractFactory("AgentEscrow");
  const escrow = await AgentEscrow.deploy(USDC, VALIDATOR, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("     AgentEscrow:", escrowAddr);

  // 2. TaskRegistry
  console.log("2/4 Deploying TaskRegistry...");
  const TaskRegistry = await ethers.getContractFactory("TaskRegistry");
  const registry = await TaskRegistry.deploy(USDC, deployer.address);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("     TaskRegistry:", registryAddr);

  // 3. Reputation
  console.log("3/4 Deploying Reputation...");
  const Reputation = await ethers.getContractFactory("Reputation");
  const reputation = await Reputation.deploy(deployer.address);
  await reputation.waitForDeployment();
  const reputationAddr = await reputation.getAddress();
  console.log("     Reputation:", reputationAddr);

  // 4. BudgetController
  console.log("4/4 Deploying BudgetController...");
  const BudgetController = await ethers.getContractFactory("BudgetController");
  const budget = await BudgetController.deploy(deployer.address);
  await budget.waitForDeployment();
  const budgetAddr = await budget.getAddress();
  console.log("     BudgetController:", budgetAddr);

  // Wire contracts together
  console.log("\nWiring contracts...");

  let tx = await registry.setEscrow(escrowAddr);
  await tx.wait();
  console.log("  TaskRegistry -> Escrow linked");

  tx = await escrow.setTaskRegistry(registryAddr);
  await tx.wait();
  console.log("  Escrow -> TaskRegistry linked");

  tx = await escrow.setReputation(reputationAddr);
  await tx.wait();
  console.log("  Escrow -> Reputation linked");

  tx = await reputation.setEscrow(escrowAddr);
  await tx.wait();
  console.log("  Reputation -> Escrow linked");

  // Output for .env
  console.log("\n══════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE — Copy to .env");
  console.log("══════════════════════════════════════");
  console.log(`USDC_ADDRESS=${USDC}`);
  console.log(`TASK_REGISTRY_ADDRESS=${registryAddr}`);
  console.log(`AGENT_ESCROW_ADDRESS=${escrowAddr}`);
  console.log(`REPUTATION_ADDRESS=${reputationAddr}`);
  console.log(`BUDGET_CONTROLLER_ADDRESS=${budgetAddr}`);
  console.log("══════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
