/**
 * PayQuorum — Configure Agent Budgets on BudgetController
 *
 * Sets daily spending limits for all agents so BudgetController.recordSpending() works.
 * Run after deploying contracts.
 *
 * Run: npx tsx scripts/configure-budgets.ts
 */
import dotenv from "dotenv";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import BudgetControllerABI from "../lib/abi/BudgetController.json" with { type: "json" };

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

async function main() {
  const budgetAddr = process.env.BUDGET_CONTROLLER_ADDRESS as `0x${string}`;
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;

  if (!budgetAddr || !deployerKey) {
    console.error("Missing BUDGET_CONTROLLER_ADDRESS or DEPLOYER_PRIVATE_KEY");
    process.exit(1);
  }

  const deployerAccount = privateKeyToAccount(deployerKey);
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http("https://rpc.testnet.arc.network"),
  });
  const walletClient = createWalletClient({
    account: deployerAccount,
    chain: arcTestnet,
    transport: http("https://rpc.testnet.arc.network"),
  });

  // 1,000,000 = $1.00 daily limit, 100,000 = $0.10 per-task limit (6-decimal USDC)
  const dailyLimit = 1_000_000n;
  const perTaskLimit = 100_000n;

  const agents = [
    { name: "ORCHESTRATOR", key: process.env.ORCHESTRATOR_PRIVATE_KEY },
    { name: "DATA_AGENT", key: process.env.DATA_AGENT_PRIVATE_KEY },
    { name: "COMPUTE_AGENT", key: process.env.COMPUTE_AGENT_PRIVATE_KEY },
    { name: "VALIDATOR", key: process.env.VALIDATOR_PRIVATE_KEY },
    { name: "TREASURY", key: process.env.TREASURY_PRIVATE_KEY },
  ];

  console.log(`Configuring budgets: $${Number(dailyLimit) / 1e6}/day, $${Number(perTaskLimit) / 1e6}/task\n`);

  for (const agent of agents) {
    if (!agent.key) continue;
    const account = privateKeyToAccount(agent.key as `0x${string}`);

    try {
      const hash = await walletClient.writeContract({
        address: budgetAddr,
        abi: BudgetControllerABI as readonly unknown[],
        functionName: "configureBudget",
        args: [account.address, dailyLimit, perTaskLimit],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✓ ${agent.name}: ${account.address}`);
      console.log(`    tx: https://testnet.arcscan.app/tx/${hash}\n`);
    } catch (error) {
      console.error(`  ✗ ${agent.name}: ${error}\n`);
    }
  }

  console.log("Done. Budgets configured.");
}

main().catch(console.error);
