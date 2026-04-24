import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getDemoSession } from "@/server/demoAuth";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SignOffSchema = z.object({
  interviewId: z.string().min(1),
  verdict: z.enum(["READY", "NEEDS_1_WEEK_PREP", "NEEDS_RESKILLING", "MISMATCH_WITH_JD"]),
  note: z.string().min(1),
});

function parseAiAssessment(transcriptJson: string | null): {
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  source?: string;
  scoredAt?: string;
} | null {
  if (!transcriptJson) return null;
  try {
    const doc = JSON.parse(transcriptJson) as {
      meta?: {
        aiAssessment?: {
          summary?: string;
          strengths?: string[];
          gaps?: string[];
          source?: string;
          scoredAt?: string;
        };
      };
    };
    return doc.meta?.aiAssessment ?? null;
  } catch {
    return null;
  }
}

export default async function InterviewReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  const id = z.string().min(1).safeParse(p?.id).data;
  if (!id) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-zinc-600">Missing interview id in URL.</p>
        <p className="mt-4">
          <Link className="underline" href="/admin/review">
            Back
          </Link>
        </p>
      </div>
    );
  }

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      engineer: { include: { user: true } },
      jd: true,
      scores: true,
      observerEvents: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!interview) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-zinc-600">Interview does not exist.</p>
        <p className="mt-4">
          <Link className="underline" href="/admin/review">
            Back
          </Link>
        </p>
      </div>
    );
  }

  const ai = parseAiAssessment(interview.transcriptJson);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Review interview</h1>
          <p className="mt-2 text-zinc-600">
            Engineer: {interview.engineer.user.email ?? interview.engineer.userId} • JD:{" "}
            {interview.jd.title ?? interview.jd.id}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Status: {interview.status} • Proposed: {interview.proposedVerdict ?? "-"} • Final:{" "}
            {interview.finalVerdict ?? "-"}
          </p>
        </div>
        <div className="flex gap-4">
          <Link className="underline" href={`/observer/interview/${interview.id}`}>
            Observer view
          </Link>
          <Link className="underline" href="/admin/review">
            Back
          </Link>
        </div>
      </div>

      {ai?.summary ? (
        <div className="mt-8 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">AI assessment (from transcript + JD + resume summary)</div>
            <span className="text-xs opacity-80">
              Source: {ai.source ?? "unknown"}
              {ai.scoredAt ? ` · ${ai.scoredAt}` : ""}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{ai.summary}</p>
          {ai.strengths?.length ? (
            <div className="mt-3 text-sm">
              <div className="font-medium">Strengths</div>
              <ul className="mt-1 list-inside list-disc text-zinc-800 dark:text-zinc-200">
                {ai.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {ai.gaps?.length ? (
            <div className="mt-3 text-sm">
              <div className="font-medium">Gaps vs JD / evidence</div>
              <ul className="mt-1 list-inside list-disc text-zinc-800 dark:text-zinc-200">
                {ai.gaps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="font-medium">Transcript (MVP)</div>
          <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
            {interview.transcriptJson ?? "(no transcript yet)"}
          </pre>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="font-medium">Scores</div>
          <div className="mt-3 grid gap-2 text-sm">
            {interview.scores.length ? (
              interview.scores.map((s) => (
                <div key={s.id} className="border-b border-zinc-100 pb-2 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600">{s.dimension}</span>
                    <span className="font-medium">{s.value}/5</span>
                  </div>
                  {s.rationale ? <p className="mt-1 text-xs leading-snug text-zinc-600 dark:text-zinc-400">{s.rationale}</p> : null}
                </div>
              ))
            ) : (
              <p className="text-zinc-600">No scores yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="font-medium">Sign-off</div>
        <p className="mt-1 text-sm text-zinc-600">
          Bench manager can override and must leave a note.
        </p>

        <form action={signOff} className="mt-4 grid gap-3">
          <input type="hidden" name="interviewId" value={interview.id} />
          <label className="grid gap-2 text-sm">
            Verdict
            <select
              className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
              name="verdict"
              defaultValue={interview.proposedVerdict ?? "NEEDS_1_WEEK_PREP"}
            >
              <option value="READY">Ready</option>
              <option value="NEEDS_1_WEEK_PREP">Needs 1-week prep</option>
              <option value="NEEDS_RESKILLING">Needs reskilling</option>
              <option value="MISMATCH_WITH_JD">Mismatch with JD</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm">
            Note (required)
            <textarea
              className="min-h-[90px] rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
              name="note"
              required
              placeholder="Explain rationale for sign-off / override…"
            />
          </label>

          <div className="pt-1">
            <button
              className="rounded-full bg-foreground px-6 py-2 text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
              type="submit"
            >
              Sign off
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="font-medium">Observer events (latest)</div>
        <div className="mt-2 grid gap-2 text-sm text-zinc-600">
          {interview.observerEvents.length ? (
            interview.observerEvents.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">{e.kind}</div>
                  <pre className="mt-1 max-h-24 overflow-auto rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
                    {e.payloadJson}
                  </pre>
                </div>
                <div className="text-xs text-zinc-500">{e.createdAt.toISOString()}</div>
              </div>
            ))
          ) : (
            <div>No observer events.</div>
          )}
        </div>
      </div>
    </div>
  );
}

async function signOff(formData: FormData) {
  "use server";

  const session = await getDemoSession();
  if (!session || session.role !== "BENCH_MANAGER") redirect("/unauthorized");

  const parsed = SignOffSchema.parse({
    interviewId: formData.get("interviewId"),
    verdict: formData.get("verdict"),
    note: formData.get("note"),
  });

  await prisma.interview.update({
    where: { id: parsed.interviewId },
    data: {
      finalVerdict: parsed.verdict,
      status: "SIGNED_OFF",
      signOffByUserId: null,
      signOffNote: parsed.note,
      signedOffAt: new Date(),
    },
  });

  redirect(`/admin/interviews/${encodeURIComponent(parsed.interviewId)}/review`);
}

