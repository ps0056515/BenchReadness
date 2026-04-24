import Link from "next/link";

type PlanSlot = { slot: number; theme: string; difficulty: string; minutes: number };

function parsePlan(raw: unknown): { slots: PlanSlot[]; focusAreas?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { slots?: PlanSlot[]; focusAreas?: string };
  const slots = Array.isArray(o.slots) ? o.slots.filter((s) => typeof s?.slot === "number" && typeof s?.theme === "string") : [];
  if (!slots.length) return null;
  return {
    slots: [...slots].sort((a, b) => a.slot - b.slot),
    focusAreas: typeof o.focusAreas === "string" && o.focusAreas.trim() ? o.focusAreas.trim() : undefined,
  };
}

export function InterviewPlanPanel({ slotsJson }: { slotsJson: string | null }) {
  let parsed: unknown = null;
  if (slotsJson) {
    try {
      parsed = JSON.parse(slotsJson) as unknown;
    } catch {
      parsed = null;
    }
  }
  const plan = parsePlan(parsed);

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="font-medium">Interview plan (10 slots)</div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        This is the <span className="font-medium">saved snapshot</span> from when this interview was created: slot
        themes, difficulty, and minutes. It is not the live voice bot script—the voice side uses the same interview id
        plus your answers to ask the next question. If you still see older themes (e.g. “Behavioral STAR”), create a{" "}
        <Link className="underline" href="/admin/setup">
          new interview from Admin → Setup
        </Link>{" "}
        to pick up the latest technical-first template.
      </p>

      {plan ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[320px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Theme</th>
                <th className="px-3 py-2 font-medium">Difficulty</th>
                <th className="px-3 py-2 font-medium">Min</th>
              </tr>
            </thead>
            <tbody>
              {plan.slots.map((s) => (
                <tr key={s.slot} className="border-b border-zinc-100 dark:border-zinc-800/80">
                  <td className="px-3 py-2 text-zinc-500">{s.slot}</td>
                  <td className="px-3 py-2">{s.theme}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{s.difficulty}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{s.minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {plan.focusAreas ? (
            <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">Focus areas:</span> {plan.focusAreas}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">(No plan attached)</p>
      )}

      <details className="mt-3 text-xs text-zinc-500">
        <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">Raw JSON (same data)</summary>
        <pre className="mt-2 max-h-[240px] overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] dark:bg-zinc-950">
          {plan && parsed ? JSON.stringify(parsed, null, 2) : slotsJson ?? "(none)"}
        </pre>
      </details>

      <p className="mt-3 text-xs text-zinc-500">
        Completion saves scores for <span className="font-medium">TechnicalKnowledge</span> and{" "}
        <span className="font-medium">Communication</span> (reviewer refines). Voice uses your browser’s Web Speech API
        (Chrome/Edge recommended)—not a separate cloud STT/TTS service yet.
      </p>
    </div>
  );
}
