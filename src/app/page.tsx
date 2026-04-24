"use client";

import { useMemo, useState } from "react";

export default function Home() {
  const [username, setUsername] = useState("Demo");
  const [password, setPassword] = useState("Demo123");
  const [role, setRole] = useState("BENCH_MANAGER");
  const [error, setError] = useState<string | null>(null);
  const next = useMemo(() => {
    if (typeof window === "undefined") return "/dashboard";
    const url = new URL(window.location.href);
    return url.searchParams.get("next") ?? "/dashboard";
  }, []);

  async function onLogin() {
    setError(null);
    const res = await fetch("/api/demo/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, role, next }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Login failed");
      return;
    }
    window.location.href = next;
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Bench Readiness
          </h1>
          <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            AI-led, voice-based mock interviews aligned to a target JD and resume, with human
            bench-manager sign-off.
          </p>
        </div>
        <div className="w-full rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="font-medium">Demo login</div>
          <p className="mt-1 text-sm text-zinc-600">
            Use <span className="font-mono">Demo</span> / <span className="font-mono">Demo123</span>
          </p>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm">
              Username
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Password
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={password}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Role (for demo)
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="ENGINEER">ENGINEER</option>
                <option value="BENCH_MANAGER">BENCH_MANAGER</option>
                <option value="TALENT">TALENT</option>
                <option value="PRACTICE_LEAD">PRACTICE_LEAD</option>
                <option value="COMPLIANCE">COMPLIANCE</option>
              </select>
            </label>
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <button
              className="mt-1 rounded-full bg-foreground px-6 py-2 text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
              type="button"
              onClick={onLogin}
            >
              Sign in
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
