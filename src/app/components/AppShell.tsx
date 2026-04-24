import Link from "next/link";
import { getDemoSession } from "@/server/demoAuth";
import { LogoutButton } from "./LogoutButton";

export async function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const session = await getDemoSession();

  const role = session?.role ?? null;
  const links: Array<{ href: string; label: string; show: boolean }> = [
    { href: "/admin", label: "Bench Manager", show: role === "BENCH_MANAGER" || role === "PRACTICE_LEAD" || role === "TALENT" },
    { href: "/admin/setup", label: "Setup", show: role === "BENCH_MANAGER" || role === "PRACTICE_LEAD" || role === "TALENT" },
    { href: "/admin/review", label: "Review", show: role === "BENCH_MANAGER" || role === "PRACTICE_LEAD" || role === "TALENT" },
    { href: "/engineer", label: "Engineer", show: role === "ENGINEER" },
    { href: "/talent", label: "Talent", show: role === "TALENT" },
    { href: "/practice", label: "Practice", show: role === "PRACTICE_LEAD" },
    { href: "/compliance", label: "Compliance", show: role === "COMPLIANCE" },
  ].filter((l) => l.show);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-semibold tracking-tight">
              Bench Readiness
            </Link>
            <nav className="hidden gap-3 md:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <div className="hidden text-sm text-zinc-600 dark:text-zinc-300 md:block">
                {session.username} <span className="text-zinc-400">({session.role})</span>
              </div>
            ) : null}
            {session ? <LogoutButton /> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}

