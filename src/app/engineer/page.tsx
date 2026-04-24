import { AppShell } from "@/app/components/AppShell";
import { EngineerActions } from "./EngineerActions";

export default async function EngineerHome() {
  return (
    <AppShell title="Engineer" subtitle="Upcoming interviews and your prep plan will appear here.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="font-medium">Take interview</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            In MVP, interviews are created by a bench manager. You’ll receive a link.
          </p>
          <div className="mt-4">
            <EngineerActions />
          </div>
        </div>
        <div className="card p-5">
          <div className="font-medium">Post-interview summary</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Strengths + targeted prep plan (verdict after manager sign-off).
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Next step: we’ll add a real “My interviews” list for engineers.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

