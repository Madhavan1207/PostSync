import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionToken,
  verifyAdminCredentials,
} from "@/lib/admin/auth";
import { parseJsonBody } from "@/lib/validation/http";

export const dynamic = "force-dynamic";

/**
 * Bounded to stop an oversized body being hashed. Deliberately no format or
 * strength rules — this validates the *shape* of a login attempt, and telling an
 * attacker their guess was "not an email" would leak the credential format.
 */
const AdminLogin = z.object({
  email: z.string().min(1).max(320),
  password: z.string().min(1).max(200),
});

/**
 * Exchanges admin credentials for an httpOnly session cookie.
 *
 * The credentials are verified against server-only env vars and never leave the
 * server; the browser receives only an opaque signed token it cannot read.
 */
export async function POST(req: Request) {
  try {
    const parsed = await parseJsonBody(req, AdminLogin);
    if (!parsed.success) return parsed.response;
    const { email, password } = parsed.data;

    if (!verifyAdminCredentials(email, password)) {
      // Deliberately vague: do not reveal whether the account or the password
      // was the problem, or whether admin auth is configured at all.
      return NextResponse.json(
        { error: "Invalid administrative credentials." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      createAdminSessionToken(),
      adminSessionCookieOptions,
    );
    return response;
  } catch (err: unknown) {
    // A missing ADMIN_SESSION_SECRET throws here. Report it as a server error
    // rather than an auth failure, but do not echo the message to the client.
    console.error("Admin login error:", err);
    return NextResponse.json(
      { error: "Administrative login is unavailable." },
      { status: 500 },
    );
  }
}
