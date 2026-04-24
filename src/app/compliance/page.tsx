import { AppShell } from "@/app/components/AppShell";

export default async function ComplianceHome() {
  return (
    <AppShell
      title="Audit & Privacy (Compliance)"
      subtitle="Retention policies, access logs, deletion requests."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="font-medium">Retention policy</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Configure audio/transcript retention per region (next step).
          </p>
        </div>
        <div className="card p-5">
          <div className="font-medium">Access logs</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Audit who accessed what interview data and when (next step).
          </p>
        </div>
      </div>
    </AppShell>
  );
}

