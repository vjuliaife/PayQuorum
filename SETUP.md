# PayQuorum — Setup Guide

Step-by-step guide to get real on-chain transactions running on Arc Testnet.

---

## Prerequisites

- Node.js 18+
- A browser (for the faucet)

---

## Step 1: Generate Wallets

```bash
cd payquorum
npx tsx scripts/generate-wallets.ts
```

This outputs 6 wallets (deployer + 5 agents). Copy the output into `.env.local`:

```bash
# Example output (your keys will be different):
DEPLOYER_PRIVATE_KEY=0xabc123...
# Address: 0x1234...

ORCHESTRATOR_PRIVATE_KEY=0xdef456...
# Address: 0x5678...

DATA_AGENT_PRIVATE_KEY=0x...
COMPUTE_AGENT_PRIVATE_KEY=0x...
VALIDATOR_PRIVATE_KEY=0x...
TREASURY_PRIVATE_KEY=0x...
```

---

## Step 2: Fund Deployer via Faucet

1. Open https://faucet.circle.com
2. Select **"Arc Testnet"** from the dropdown
3. Paste the **DEPLOYER address** (the `# Address:` line from Step 1)
4. Click **Send**
5. Wait ~10 seconds — you'll receive **20 USDC** on Arc Testnet

You can verify at: `https://testnet.arcscan.app/address/YOUR_DEPLOYER_ADDRESS`

---

## Step 3: Fund Agent Wallets

The deployer distributes USDC to all 5 agent wallets:

```bash
npx tsx scripts/fund-agents.ts
```

Expected output:
```
Deployer: 0x1234...
Balance:  20.000000000000000000 USDC (native 18-dec)

Sending 3 USDC to each agent...

  ✓ ORCHESTRATOR: 0x5678...
    tx: https://testnet.arcscan.app/tx/0xabc...
    status: success

  ✓ DATA_AGENT: 0x9abc...
    tx: https://testnet.arcscan.app/tx/0xdef...
    status: success
  ...
```

Each transaction link is a **real on-chain transaction** on Arc Testnet.

---

## Step 4: Verify Balances

```bash
npx tsx scripts/check-balances.ts
```

Expected:
```
  ● DEPLOYER       0x1234...  5.0000 USDC
  ● ORCHESTRATOR   0x5678...  3.0000 USDC
  ● DATA_AGENT     0x9abc...  3.0000 USDC
  ● COMPUTE_AGENT  0xdef0...  3.0000 USDC
  ● VALIDATOR      0x1357...  3.0000 USDC
  ● TREASURY       0x2468...  3.0000 USDC

  All wallets funded. Ready to deploy contracts.
```

---

## Step 5: Deploy Smart Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network arcTestnet
```

Output:
```
1/4 Deploying AgentEscrow...
     AgentEscrow: 0xABC...
2/4 Deploying TaskRegistry...
     TaskRegistry: 0xDEF...
3/4 Deploying Reputation...
     Reputation: 0x123...
4/4 Deploying BudgetController...
     BudgetController: 0x456...

══════════════════════════════════════
  DEPLOYMENT COMPLETE — Copy to .env
══════════════════════════════════════
TASK_REGISTRY_ADDRESS=0xDEF...
AGENT_ESCROW_ADDRESS=0xABC...
REPUTATION_ADDRESS=0x123...
BUDGET_CONTROLLER_ADDRESS=0x456...
══════════════════════════════════════
```

**Copy these addresses into `.env.local`** in the root of the project.

---

## Step 5b: Verify Contracts on ArcScan

This makes the Solidity source code publicly readable on the block explorer:

```bash
npx hardhat run scripts/verify-contracts.ts --network arcTestnet
```

Expected output:
```
  Verifying AgentEscrow at 0xC79BE48Cf33bA378fD6826cBAEbBaC6f0D05c389...
    ✓ VERIFIED

  Verifying TaskRegistry at 0x2Ec3180e23AC9C82205cb3Cd6885f2a27543E291...
    ✓ VERIFIED

  Verifying Reputation at 0xfB225D66f7627F2e0a39A8F0D927253F6fF8A9CB...
    ✓ VERIFIED

  Verifying BudgetController at 0x571eC845335B89985Be599dD6Bd40b77B072C455...
    ✓ VERIFIED
```

View verified source at:
- [TaskRegistry](https://testnet.arcscan.app/address/0x2Ec3180e23AC9C82205cb3Cd6885f2a27543E291#code)
- [AgentEscrow](https://testnet.arcscan.app/address/0xC79BE48Cf33bA378fD6826cBAEbBaC6f0D05c389#code)
- [Reputation](https://testnet.arcscan.app/address/0xfB225D66f7627F2e0a39A8F0D927253F6fF8A9CB#code)
- [BudgetController](https://testnet.arcscan.app/address/0x571eC845335B89985Be599dD6Bd40b77B072C455#code)

---

## Step 5c: Register Agents & Configure Budgets

```bash
cd ..  # back to payquorum root
npx tsx scripts/register-agents.ts     # Register all 5 agents in Reputation
npx tsx scripts/set-validator.ts       # Set validator address in Escrow
npx tsx scripts/configure-budgets.ts   # Set $1/day, $0.10/task limits
```

---

## Step 6: Add Remaining Config to .env.local

Your `.env.local` should now look like:

```bash
# Wallets (from Step 1)
DEPLOYER_PRIVATE_KEY=0x...
ORCHESTRATOR_PRIVATE_KEY=0x...
DATA_AGENT_PRIVATE_KEY=0x...
COMPUTE_AGENT_PRIVATE_KEY=0x...
VALIDATOR_PRIVATE_KEY=0x...
TREASURY_PRIVATE_KEY=0x...

# Contracts (from Step 5)
TASK_REGISTRY_ADDRESS=0x...
AGENT_ESCROW_ADDRESS=0x...
REPUTATION_ADDRESS=0x...
BUDGET_CONTROLLER_ADDRESS=0x...

# Chain
ARC_TESTNET_RPC=https://rpc.testnet.arc.network
USDC_ADDRESS=0x3600000000000000000000000000000000000000

# AI Services
AISA_API_KEY=your_key_here
GEMINI_API_KEY=your_key_from_aistudio.google.com
FEATHERLESS_API_KEY=your_key_from_featherless.ai

# x402 Facilitator (default works)
X402_FACILITATOR_URL=https://x402.org/facilitator
```

---

## Step 7: Run the App

```bash
cd payquorum  # (back to root if you were in contracts/)
npm run dev
```

Open http://localhost:3000/dashboard and click **"Run Demo"**.

Every transaction in the feed is now **real and on-chain**. Click any transaction hash to view it on https://testnet.arcscan.app.

---

## What Happens On-Chain

When you click "Run Demo", for each task cycle:

| Step | On-Chain Action | Contract |
|------|----------------|----------|
| 1 | USDC.approve(TaskRegistry, bounty) | USDC Precompile |
| 2 | TaskRegistry.createTask() → transfers bounty to Escrow | TaskRegistry |
| 3 | AgentEscrow.recordEscrow() | AgentEscrow |
| 4 | TaskRegistry.placeBid() | TaskRegistry |
| 5 | TaskRegistry.assignTask() | TaskRegistry |
| 6 | AgentEscrow.setAssignee() | AgentEscrow |
| 7 | AgentEscrow.releaseToExecutor() → USDC to executor | AgentEscrow |
| 8 | Reputation.recordSuccess() (cross-contract) | Reputation |
| 9 | BudgetController.recordSpending() | BudgetController |

Each produces a real transaction hash viewable on ArcScan.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Escrow contract not deployed" | Complete Step 5 and add addresses to .env.local |
| "AIsa 401 Unauthorized" | Get an API key from AIsa or remove AISA_API_KEY to use fallback |
| "insufficient funds" | Fund the specific wallet via faucet or fund-agents script |
| Faucet rate-limited | Wait 2 hours, or fund one wallet and distribute with fund-agents.ts |
| Transaction reverts | Check the contract addresses are correct and match the network |

---

## Deployed & Verified Contract Links

| Contract | ArcScan (Verified Source) |
|----------|--------------------------|
| TaskRegistry | https://testnet.arcscan.app/address/0x2Ec3180e23AC9C82205cb3Cd6885f2a27543E291#code |
| AgentEscrow | https://testnet.arcscan.app/address/0xC79BE48Cf33bA378fD6826cBAEbBaC6f0D05c389#code |
| Reputation | https://testnet.arcscan.app/address/0xfB225D66f7627F2e0a39A8F0D927253F6fF8A9CB#code |
| BudgetController | https://testnet.arcscan.app/address/0x571eC845335B89985Be599dD6Bd40b77B072C455#code |

## Explorer URL Patterns

- **Transactions:** `https://testnet.arcscan.app/tx/{hash}`
- **Addresses:** `https://testnet.arcscan.app/address/{address}`
- **Contracts:** `https://testnet.arcscan.app/address/{contractAddress}#code`
