import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/validation/http";
import { getRazorpayClient } from "@/lib/payments/razorpay";

/**
 * Creates a Razorpay order for Standard Checkout.
 *
 * The amount is in the smallest currency unit (paise for INR). Razorpay rejects
 * anything under 100 paise (₹1), so it is bounded here to fail as a clean 400
 * rather than a Razorpay API error. `receipt` is an optional caller-side
 * reference echoed back on the order.
 */
const CreateOrderBody = z.object({
  amount: z
    .number()
    .int("Amount must be a whole number of paise.")
    .min(100, "Amount must be at least 100 paise (₹1)."),
  currency: z.string().trim().length(3).toUpperCase().default("INR"),
  receipt: z.string().trim().max(40).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, CreateOrderBody);
  if (!parsed.success) return parsed.response;

  const { amount, currency, receipt } = parsed.data;

  try {
    const order = await getRazorpayClient().orders.create({
      amount,
      currency,
      receipt: receipt ?? `rcpt_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: user.id },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    // Razorpay's SDK surfaces auth failures with statusCode 401; treat those as
    // a configuration problem (bad keys) rather than a generic server error.
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;

    if (statusCode === 401) {
      return NextResponse.json(
        { error: "Payment gateway authentication failed." },
        { status: 401 },
      );
    }

    console.error("Razorpay order creation failed:", err);
    return NextResponse.json(
      { error: "Could not create payment order." },
      { status: 500 },
    );
  }
}
