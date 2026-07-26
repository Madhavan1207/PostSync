import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay server-side helpers.
 *
 * The key id and secret are read lazily (at first use, not at import) for the
 * same reason as the other integrations in this app: validating at module load
 * would run during `next build`, where the secret is legitimately absent, and
 * would break the build for pages that never touch payments.
 *
 * The secret never leaves the server — it signs orders and verifies payment
 * signatures here. Only `RAZORPAY_KEY_ID` is also published to the browser (as
 * `NEXT_PUBLIC_RAZORPAY_KEY_ID`) because Checkout.js needs it.
 */

let cachedClient: Razorpay | null = null;

function getCredentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local (see .env.example).",
    );
  }
  return { keyId, keySecret };
}

/** Returns a memoised Razorpay client, or throws if the keys are unset. */
export function getRazorpayClient(): Razorpay {
  if (cachedClient) return cachedClient;
  const { keyId, keySecret } = getCredentials();
  cachedClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return cachedClient;
}

/**
 * Verifies a Checkout callback signature.
 *
 * Razorpay signs `order_id + "|" + payment_id` with HMAC-SHA256 keyed by the
 * secret. A constant-time comparison avoids leaking, via response timing, how
 * much of a forged signature was correct.
 */
export function isValidPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = getCredentials();
  const expected = createHmac("sha256", keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(params.signature, "utf8");
  // timingSafeEqual throws on length mismatch, which is itself a mismatch.
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
