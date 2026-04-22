import { run } from "hardhat";
import dotenv from "dotenv";
import path from "path";
import { ethers } from "hardhat";

/**
 * PayQuorum — Verify All 4 Contracts on ArcScan (Blockscout)
 *
 * This submits source code to testnet.arcscan.app so anyone can
 * read the Solidity code, check constructor args, and audit the logic.
 *
 * Run: npx hardhat run scripts/verify-contracts.ts --network arcTestnet
 *
 * Prerequisites:
 *   - Contracts already deployed (addresses in ../.env.local)
 *   - hardhat.config.ts has etherscan.customChains configured
 */

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const USDC = process.env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000";
const DEPLOYER = new ethers.Wallet(
  process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64)
).address;

// At deploy time, VALIDATOR was set to deployer.address (see deploy.ts line 23)
const VALIDATOR = DEPLOYER;

const contracts = [
  {
    name: "AgentEscrow",
    address: process.env.AGENT_ESCROW_ADDRESS,
    constructorArgs: [USDC, VALIDATOR, DEPLOYER],
  },
  {
    name: "TaskRegistry",
    address: process.env.TASK_REGISTRY_ADDRESS,
    constructorArgs: [USDC, DEPLOYER],
  },
  {
    name: "Reputation",
    address: process.env.REPUTATION_ADDRESS,
    constructorArgs: [DEPLOYER],
  },
  {
    name: "BudgetController",
    address: process.env.BUDGET_CONTROLLER_ADDRESS,
    constructorArgs: [DEPLOYER],
  },
];

async function main() {
  console.log("══════════════════════════════════════════════════");
  console.log("  PayQuorum — Contract Verification on ArcScan");
  console.log("  Explorer: https://testnet.arcscan.app");
  console.log("══════════════════════════════════════════════════\n");
  console.log(`  Deployer: ${DEPLOYER}`);
  console.log(`  USDC:     ${USDC}`);
  console.log(`  Validator: ${VALIDATOR}\n`);

  for (const contract of contracts) {
    if (!contract.address) {
      console.log(`  SKIP: ${contract.name} — address not set in .env.local\n`);
      continue;
    }

    console.log(`  Verifying ${contract.name} at ${contract.address}...`);
    console.log(`    Constructor args: [${contract.constructorArgs.map(a => `"${a}"`).join(", ")}]`);

    try {
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.constructorArgs,
      });
      console.log(`    ✓ VERIFIED — https://testnet.arcscan.app/address/${contract.address}#code\n`);
    } catch (error) {
      const msg = String(error);
      if (msg.includes("Already Verified") || msg.includes("already verified")) {
        console.log(`    ● Already verified — https://testnet.arcscan.app/address/${contract.address}#code\n`);
      } else {
        console.error(`    ✗ FAILED: ${msg.slice(0, 200)}\n`);
      }
    }
  }

  console.log("══════════════════════════════════════════════════");
  console.log("  Verification complete. View source code at:");
  for (const c of contracts) {
    if (c.address) {
      console.log(`    ${c.name}: https://testnet.arcscan.app/address/${c.address}#code`);
    }
  }
  console.log("══════════════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
