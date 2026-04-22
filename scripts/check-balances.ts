/**
 * PayQuorum — Check All Wallet Balances
 *
 * Verifies that all wallets are funded and shows their Arc Testnet balances.
 *
 * Run: npx tsx scripts/check-balances.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createPublicClient, http, formatUnits, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

async function main() {
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http("https://rpc.testnet.arc.network"),
  });

  const wallets = [
    { name: "DEPLOYER", key: process.env.DEPLOYER_PRIVATE_KEY },
    { name: "ORCHESTRATOR", key: process.env.ORCHESTRATOR_PRIVATE_KEY },
    { name: "DATA_AGENT", key: process.env.DATA_AGENT_PRIVATE_KEY },
    { name: "COMPUTE_AGENT", key: process.env.COMPUTE_AGENT_PRIVATE_KEY },
    { name: "VALIDATOR", key: process.env.VALIDATOR_PRIVATE_KEY },
    { name: "TREASURY", key: process.env.TREASURY_PRIVATE_KEY },
  ];

  console.log("═══════════════════════════════════════════════════════");
  console.log("  PayQuorum — Wallet Balances (Arc Testnet)");
  console.log("═══════════════════════════════════════════════════════\n");

  let allFunded = true;

  for (const wallet of wallets) {
    if (!wallet.key) {
      console.log(`  ○ ${wallet.name.padEnd(14)} — NOT CONFIGURED`);
      allFunded = false;
      continue;
    }

    const account = privateKeyToAccount(wallet.key as `0x${string}`);
    const balance = await publicClient.getBalance({ address: account.address });
    const usdc = formatUnits(balance, 18);
    const funded = balance > 0n;

    if (!funded) allFunded = false;

    console.log(
      `  ${funded ? "●" : "○"} ${wallet.name.padEnd(14)} ${account.address}  ${Number(usdc).toFixed(4)} USDC`
    );
  }

  console.log("\n═══════════════════════════════════════════════════════");
  if (allFunded) {
    console.log("  All wallets funded. Ready to deploy contracts.");
  } else {
    console.log("  Some wallets need funding. See steps above.");
  }
  console.log("═══════════════════════════════════════════════════════");
}

main().catch(console.error);
