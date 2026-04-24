import { NextResponse } from "next/server";
import { demoCookieName } from "@/server/demoAuth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(demoCookieName(), "", { path: "/", maxAge: 0 });
  return res;
}

