import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@/server/roles";
import { verifyDemoSession } from "@/server/demoAuth";

const ROUTE_ALLOWLIST: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/engineer", roles: ["ENGINEER"] },
  { prefix: "/interview", roles: ["ENGINEER", "BENCH_MANAGER", "PRACTICE_LEAD"] },
  { prefix: "/observer", roles: ["BENCH_MANAGER", "PRACTICE_LEAD"] },
  { prefix: "/admin", roles: ["BENCH_MANAGER", "PRACTICE_LEAD", "TALENT"] },
  { prefix: "/talent", roles: ["TALENT"] },
  { prefix: "/practice", roles: ["PRACTICE_LEAD"] },
  { prefix: "/compliance", roles: ["COMPLIANCE"] },
];

function allowedRoles(pathname: string): UserRole[] | null {
  for (const r of ROUTE_ALLOWLIST) if (pathname.startsWith(r.prefix)) return r.roles;
  return null;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/demo")) return NextResponse.next();
  // Disable NextAuth endpoints in demo mode (avoid confusion).
  if (pathname.startsWith("/api/auth")) return NextResponse.redirect(new URL("/", req.url));
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname.startsWith("/favicon")) return NextResponse.next();

  const roles = allowedRoles(pathname);
  if (!roles) return NextResponse.next();

  const cookie = req.cookies.get("br_demo_session")?.value;
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const session = await verifyDemoSession(cookie);
  const userRole = session?.role as UserRole | undefined;
  if (!userRole) {
    const url = req.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }
  if (!roles.includes(userRole)) {
    const url = req.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/health).*)"],
};

