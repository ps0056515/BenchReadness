import { NextResponse } from "next/server";
import { z } from "zod";
import { demoCookieName, signDemoSession } from "@/server/demoAuth";
import { USER_ROLES, type UserRole } from "@/server/roles";

export const runtime = "nodejs";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(USER_ROLES),
  next: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const { username, password, role } = parsed.data;
  if (!(username === "Demo" && password === "Demo123")) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signDemoSession({ username, role: role as UserRole });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(demoCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return res;
}

