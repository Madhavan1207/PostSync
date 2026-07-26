import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/validation/http";
import { isValidPaymentSignature } from "@/lib/payments/razorpay";

/**
 * Verifies the signature returned by Razorpay Checkout on a successful payment.
 *
 * The three fields come straight from the Checkout success handler. Never trust
 * the browser's word that a payment succeeded — recompute the HMAC server-side
 * and only treat the payment as genuine when it matches.
 */
const VerifyPaymentBody = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, VerifyPaymentBody);
  if (!parsed.success) return parsed.response;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    parsed.data;

  const valid = isValidPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    // Signature mismatch — the payment is not trustworthy. Do not record it as paid.
    return NextResponse.json(
      { verified: false, error: "Payment signature verification failed." },
      { status: 400 },
    );
  }

  // Signature is genuine. This project has no orders/payments table, so there is
  // nothing to persist here — a caller with a database should record the paid
  // order (payment_id, order_id, user.id) at this point.
  return NextResponse.json({
    verified: true,
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id,
  });
}
