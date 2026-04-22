/**
 * x402 Seller — Payment verification for Next.js Route Handlers.
 *
 * Since @x402/express middleware doesn't work in Next.js Route Handlers,
 * we use the lower-level @x402/core API for manual payment verification.
 *
 * Flow:
 * 1. Route handler checks for PAYMENT-SIGNATURE header
 * 2. If missing → return 402 with PAYMENT-REQUIRED header
 * 3. If present → verify with facilitator, serve content
 */
import { config } from "./config";

interface PaymentRequirements {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    extra: Record<string, unknown>;
  }>;
}

/**
 * Build a 402 response with payment requirements.
 */
export function build402Response(
  price: string,
  payTo: string,
  description: string,
  resourceUrl: string,
): Response {
  // Convert price like "$0.005" to USDC smallest unit (6 decimals)
  const cleaned = price.replace("$", "");
  const [whole, frac = ""] = cleaned.split(".");
  const amount = (BigInt(whole || "0") * 1_000_000n + BigInt(frac.padEnd(6, "0").slice(0, 6))).toString();

  const requirements: PaymentRequirements = {
    x402Version: 2,
    accepts: [{
      scheme: "exact",
      network: config.x402Network,
      maxAmountRequired: amount,
      resource: resourceUrl,
      description,
      mimeType: "application/json",
      payTo,
      maxTimeoutSeconds: 60,
      asset: config.contracts.usdc,
      extra: {},
    }],
  };

  const encoded = Buffer.from(JSON.stringify(requirements)).toString("base64");

  return new Response(JSON.stringify({ error: "Payment Required", requirements }), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": encoded,
    },
  });
}

/**
 * Verify an x402 payment signature by calling the facilitator.
 * Returns true if payment is valid and settled.
 */
export async function verifyPayment(request: Request): Promise<boolean> {
  const paymentSig = request.headers.get("PAYMENT-SIGNATURE") || request.headers.get("payment-signature");
  if (!paymentSig) return false;

  try {
    const res = await fetch(`${config.x402FacilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentSignature: paymentSig }),
    });

    if (!res.ok) return false;
    const result = await res.json();
    return result?.isValid === true;
  } catch {
    return false;
  }
}

/**
 * Settle a verified x402 payment.
 */
export async function settlePayment(request: Request): Promise<{ txHash?: string; settled: boolean }> {
  const paymentSig = request.headers.get("PAYMENT-SIGNATURE") || request.headers.get("payment-signature");
  if (!paymentSig) return { settled: false };

  try {
    const res = await fetch(`${config.x402FacilitatorUrl}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentSignature: paymentSig }),
    });

    if (!res.ok) return { settled: false };
    const result = await res.json();
    return { txHash: result?.txHash, settled: true };
  } catch {
    return { settled: false };
  }
}
