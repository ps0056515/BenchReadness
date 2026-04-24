import { AppShell } from "@/app/components/AppShell";
import Link from "next/link";

export default async function TalentHome() {
  return (
    <AppShell
      title="Talent / HR Ops"
      subtitle="Owns question banks, rubric templates, and platform governance."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="card p-5 hover:bg-zinc-50 dark:hover:bg-zinc-950" href="/talent/questions">
          <div className="font-medium">Question bank</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage curated questions, variants, and tags.
          </p>
        </Link>
        <Link className="card p-5 hover:bg-zinc-50 dark:hover:bg-zinc-950" href="/talent/rubrics">
          <div className="font-medium">Rubrics</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Versioned rubric templates per role/level.
          </p>
        </Link>
      </div>
    </AppShell>
  );
}

