/**
 * PayQuorum — Register Agents in Reputation Contract
 *
 * Registers all 5 agent wallets in the on-chain Reputation system.
 * Must be run after contract deployment.
 *
 * Run: npx tsx scripts/register-agents.ts
 */
import dotenv from "dotenv";
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import ReputationABI from "../lib/abi/Reputation.json" with { type: "json" };

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
  const reputationAddr = process.env.REPUTATION_ADDRESS as `0x${string}`;
  if (!reputationAddr) {
    console.error("ERROR: REPUTATION_ADDRESS not set. Deploy contracts first.");
    process.exit(1);
  }

  // Use deployer to register all agents
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
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

  const agents = [
    { name: "ORCHESTRATOR", key: process.env.ORCHESTRATOR_PRIVATE_KEY },
    { name: "DATA_AGENT", key: process.env.DATA_AGENT_PRIVATE_KEY },
    { name: "COMPUTE_AGENT", key: process.env.COMPUTE_AGENT_PRIVATE_KEY },
    { name: "VALIDATOR", key: process.env.VALIDATOR_PRIVATE_KEY },
    { name: "TREASURY", key: process.env.TREASURY_PRIVATE_KEY },
  ];

  console.log("Registering agents in Reputation contract...\n");
  console.log(`Reputation: ${reputationAddr}\n`);

  for (const agent of agents) {
    if (!agent.key) {
      console.log(`  SKIP: ${agent.name} — no key`);
      continue;
    }

    const account = privateKeyToAccount(agent.key as `0x${string}`);

    try {
      const hash = await walletClient.writeContract({
        address: reputationAddr,
        abi: ReputationABI as readonly unknown[],
        functionName: "registerAgent",
        args: [account.address],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✓ ${agent.name}: ${account.address}`);
      console.log(`    tx: https://testnet.arcscan.app/tx/${hash} (${receipt.status})\n`);
    } catch (error) {
      const msg = String(error);
      if (msg.includes("already registered")) {
        console.log(`  ● ${agent.name}: ${account.address} — already registered\n`);
      } else {
        console.error(`  ✗ ${agent.name}: ${error}\n`);
      }
    }
  }

  console.log("Done. Agents can now earn reputation from task completions.");
}

main().catch(console.error);
