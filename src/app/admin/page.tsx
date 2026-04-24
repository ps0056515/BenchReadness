import Link from "next/link";
import { AppShell } from "@/app/components/AppShell";

export default async function AdminHome() {
  return (
    <AppShell
      title="Bench Manager"
      subtitle="Create interview plans from JD + resume, review results, and sign off readiness."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="card p-5 hover:bg-zinc-50 dark:hover:bg-zinc-950" href="/admin/setup">
          <div className="font-medium">Setup assessment</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Paste JD + engineer details → generate plan → create interview.
          </p>
        </Link>
        <Link className="card p-5 hover:bg-zinc-50 dark:hover:bg-zinc-950" href="/admin/review">
          <div className="font-medium">Review & sign-off</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            View transcript, scores, proposed verdict, overrides, and approvals.
          </p>
        </Link>
      </div>
    </AppShell>
  );
}

