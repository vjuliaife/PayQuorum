import { NextResponse, type NextRequest } from "next/server";
import { getWalletClient, getPublicClient, BudgetControllerABI } from "@/lib/blockchain";
import { config } from "@/lib/config";
import { emitEvent } from "@/lib/events";
import { privateKeyToAccount } from "viem/accounts";

/**
 * POST /api/budget/configure
 * Configure agent budget limits from the frontend.
 *
 * Body: { dailyLimit: "1.00", perTaskLimit: "0.10" }
 *
 * Sends all 5 configureBudget transactions immediately (non-blocking).
 * Returns right away with submitted tx hashes. Confirmations stream via SSE.
 */
export async function POST(request: NextRequest) {
  if (!config.contracts.budgetController) {
    return NextResponse.json({ error: "BudgetController not deployed. Set BUDGET_CONTROLLER_ADDRESS in .env.local" }, { status: 503 });
  }

  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  if (!deployerKey) {
    return NextResponse.json({ error: "DEPLOYER_PRIVATE_KEY not set in .env.local" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const dailyLimitUsd = parseFloat(body.dailyLimit || "1.00");
    const perTaskLimitUsd = parseFloat(body.perTaskLimit || "0.10");

    const dailyLimit = BigInt(Math.round(dailyLimitUsd * 1_000_000));
    const perTaskLimit = BigInt(Math.round(perTaskLimitUsd * 1_000_000));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = getWalletClient(deployerKey) as any;
    const publicClient = getPublicClient();

    const agentKeys = [
      process.env.ORCHESTRATOR_PRIVATE_KEY,
      process.env.DATA_AGENT_PRIVATE_KEY,
      process.env.COMPUTE_AGENT_PRIVATE_KEY,
      process.env.VALIDATOR_PRIVATE_KEY,
      process.env.TREASURY_PRIVATE_KEY,
    ].filter(Boolean) as `0x${string}`[];

    // Send transactions sequentially (same wallet = nonce must be ordered)
    // but don't wait for receipts (confirmations stream via SSE)
    const results: Array<{ agent: string; tx?: string; error?: string; status: string }> = [];

    for (const key of agentKeys) {
      const account = privateKeyToAccount(key);
      try {
        const hash = await walletClient.writeContract({
          address: config.contracts.budgetController,
          abi: BudgetControllerABI,
          functionName: "configureBudget",
          args: [account.address, dailyLimit, perTaskLimit],
        });

        results.push({ agent: account.address.slice(0, 12), tx: hash, status: "submitted" });

        // Confirm in background — don't block the response
        publicClient.waitForTransactionReceipt({ hash }).then(() => {
          emitEvent("budget:recorded", {
            action: "budget_configured",
            agent: account.address.slice(0, 12),
            dailyLimit: dailyLimitUsd,
            perTaskLimit: perTaskLimitUsd,
            tx: hash,
            onChain: true,
          });
        }).catch(() => {});
      } catch (error) {
        results.push({ agent: account.address.slice(0, 12), error: String(error).slice(0, 100), status: "failed" });
      }
    }
    const succeeded = results.filter((r) => r.status === "submitted").length;

    return NextResponse.json({
      success: succeeded > 0,
      dailyLimit: dailyLimitUsd,
      perTaskLimit: perTaskLimitUsd,
      agentsConfigured: succeeded,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).slice(0, 200) }, { status: 500 });
  }
}
