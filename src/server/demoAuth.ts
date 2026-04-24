import { cookies } from "next/headers";
import type { UserRole } from "@/server/roles";

const COOKIE_NAME = "br_demo_session";

export type DemoSession = {
  username: string;
  role: UserRole;
};

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret-change-me";
}

async function hmacSHA256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Buffer.from(sig).toString("base64url");
}

function b64urlEncode(json: unknown): string {
  return Buffer.from(JSON.stringify(json), "utf8").toString("base64url");
}

function b64urlDecode<T>(b64: string): T | null {
  try {
    const raw = Buffer.from(b64, "base64url").toString("utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function signDemoSession(session: DemoSession): Promise<string> {
  const payload = b64urlEncode(session);
  const sig = await hmacSHA256(getSecret(), payload);
  return `${payload}.${sig}`;
}

export async function verifyDemoSession(token: string): Promise<DemoSession | null> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacSHA256(getSecret(), payload);
  if (sig !== expected) return null;
  return b64urlDecode<DemoSession>(payload);
}

export async function getDemoSession(): Promise<DemoSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyDemoSession(token);
}

export async function clearDemoSessionCookie() {
  (await cookies()).set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export function demoCookieName() {
  return COOKIE_NAME;
}

