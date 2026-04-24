import { AppShell } from "@/app/components/AppShell";

export default async function PracticeLeadHome() {
  return (
    <AppShell
      title="Practice Lead / Architect"
      subtitle="Calibrates rubrics, reviews flagged interviews, resolves disputes."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="font-medium">Calibration</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Review gold-standard interviews and adjust rubric thresholds (next step).
          </p>
        </div>
        <div className="card p-5">
          <div className="font-medium">Flagged reviews</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Prioritize high-risk interviews and disputed verdicts (next step).
          </p>
        </div>
      </div>
    </AppShell>
  );
}

