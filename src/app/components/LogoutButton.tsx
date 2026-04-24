"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/demo/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
    >
      Sign out
    </button>
  );
}

