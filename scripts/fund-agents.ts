/**
 * PayQuorum — Fund Agent Wallets
 *
 * Distributes USDC from the deployer wallet to all 5 agent wallets on Arc Testnet.
 * The deployer must already be funded via https://faucet.circle.com.
 *
 * Run: npx tsx scripts/fund-agents.ts
 *
 * Prerequisites:
 *   - .env.local with DEPLOYER_PRIVATE_KEY funded
 *   - Agent wallet keys in .env.local
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" }); // fallback
import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

const AMOUNT_PER_AGENT = parseUnits("3", 18); // 3 USDC in 18-decimal native format

async function main() {
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  if (!deployerKey) {
    console.error("ERROR: DEPLOYER_PRIVATE_KEY not set in .env.local");
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

  // Check deployer balance
  const deployerBalance = await publicClient.getBalance({ address: deployerAccount.address });
  console.log(`\nDeployer: ${deployerAccount.address}`);
  console.log(`Balance:  ${formatUnits(deployerBalance, 18)} USDC (native 18-dec)`);
  console.log(`          ${formatUnits(deployerBalance / 10n ** 12n, 6)} USDC (equivalent 6-dec)\n`);

  if (deployerBalance === 0n) {
    console.error("ERROR: Deployer has zero balance. Fund it first at https://faucet.circle.com");
    process.exit(1);
  }

  // Agent wallets to fund
  const agents = [
    { name: "ORCHESTRATOR", key: process.env.ORCHESTRATOR_PRIVATE_KEY as `0x${string}` },
    { name: "DATA_AGENT", key: process.env.DATA_AGENT_PRIVATE_KEY as `0x${string}` },
    { name: "COMPUTE_AGENT", key: process.env.COMPUTE_AGENT_PRIVATE_KEY as `0x${string}` },
    { name: "VALIDATOR", key: process.env.VALIDATOR_PRIVATE_KEY as `0x${string}` },
    { name: "TREASURY", key: process.env.TREASURY_PRIVATE_KEY as `0x${string}` },
  ];

  console.log(`Sending ${formatUnits(AMOUNT_PER_AGENT, 18)} USDC to each agent...\n`);

  for (const agent of agents) {
    if (!agent.key) {
      console.log(`  SKIP: ${agent.name} — no private key set`);
      continue;
    }

    const agentAccount = privateKeyToAccount(agent.key);

    try {
      const hash = await walletClient.sendTransaction({
        to: agentAccount.address,
        value: AMOUNT_PER_AGENT,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log(`  ✓ ${agent.name}: ${agentAccount.address}`);
      console.log(`    tx: https://testnet.arcscan.app/tx/${hash}`);
      console.log(`    status: ${receipt.status}\n`);
    } catch (error) {
      console.error(`  ✗ ${agent.name}: FAILED — ${error}`);
    }
  }

  // Final balance
  const finalBalance = await publicClient.getBalance({ address: deployerAccount.address });
  console.log(`\nDeployer remaining: ${formatUnits(finalBalance, 18)} USDC`);
  console.log("Done.");
}

main().catch(console.error);
