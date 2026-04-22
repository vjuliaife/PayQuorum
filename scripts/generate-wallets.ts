/**
 * PayQuorum — Wallet Generation Script
 *
 * Generates 6 wallets (deployer + 5 agents) for Arc Testnet.
 * Outputs private keys and addresses to copy into .env.local.
 *
 * Run: npx tsx scripts/generate-wallets.ts
 *
 * After generating:
 * 1. Copy the output to .env.local
 * 2. Fund the DEPLOYER wallet at https://faucet.circle.com (select "Arc Testnet")
 * 3. Run: npx tsx scripts/fund-agents.ts  (distributes USDC from deployer to agents)
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const ROLES = [
  "DEPLOYER",
  "ORCHESTRATOR",
  "DATA_AGENT",
  "COMPUTE_AGENT",
  "VALIDATOR",
  "TREASURY",
] as const;

console.log("═══════════════════════════════════════════════════════");
console.log("  PayQuorum — Wallet Generator (Arc Testnet)");
console.log("  Chain ID: 5042002");
console.log("  RPC: https://rpc.testnet.arc.network");
console.log("═══════════════════════════════════════════════════════\n");

console.log("# Copy these to .env.local:\n");

for (const role of ROLES) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log(`# ${role}`);
  console.log(`${role}_PRIVATE_KEY=${privateKey}`);
  console.log(`# Address: ${account.address}\n`);
}

console.log("\n═══════════════════════════════════════════════════════");
console.log("  NEXT STEPS:");
console.log("  1. Copy the above into .env.local");
console.log("  2. Go to https://faucet.circle.com");
console.log("     → Select 'Arc Testnet'");
console.log("     → Paste the DEPLOYER address");
console.log("     → Click send (gives ~20 USDC)");
console.log("  3. Run: npx tsx scripts/fund-agents.ts");
console.log("     → Distributes 3 USDC to each agent wallet");
console.log("  4. Run: npx tsx scripts/check-balances.ts");
console.log("     → Verifies all wallets are funded");
console.log("═══════════════════════════════════════════════════════");
