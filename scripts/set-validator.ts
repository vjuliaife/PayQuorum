/**
 * PayQuorum — Set Validator Address in AgentEscrow
 *
 * Updates the AgentEscrow contract to use the VALIDATOR agent wallet
 * as the authorized validator (instead of the deployer).
 *
 * Run: npx tsx scripts/set-validator.ts
 */
import dotenv from "dotenv";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import AgentEscrowABI from "../lib/abi/AgentEscrow.json" with { type: "json" };

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
  const escrowAddr = process.env.AGENT_ESCROW_ADDRESS as `0x${string}`;
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  const validatorKey = process.env.VALIDATOR_PRIVATE_KEY as `0x${string}`;

  if (!escrowAddr || !deployerKey || !validatorKey) {
    console.error("Missing AGENT_ESCROW_ADDRESS, DEPLOYER_PRIVATE_KEY, or VALIDATOR_PRIVATE_KEY");
    process.exit(1);
  }

  const deployerAccount = privateKeyToAccount(deployerKey);
  const validatorAccount = privateKeyToAccount(validatorKey);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http("https://rpc.testnet.arc.network"),
  });

  const walletClient = createWalletClient({
    account: deployerAccount,
    chain: arcTestnet,
    transport: http("https://rpc.testnet.arc.network"),
  });

  console.log(`Setting validator to: ${validatorAccount.address}`);
  console.log(`Escrow contract: ${escrowAddr}\n`);

  const hash = await walletClient.writeContract({
    address: escrowAddr,
    abi: AgentEscrowABI as readonly unknown[],
    functionName: "setValidator",
    args: [validatorAccount.address],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ Validator updated`);
  console.log(`  tx: https://testnet.arcscan.app/tx/${hash} (${receipt.status})`);
}

main().catch(console.error);
