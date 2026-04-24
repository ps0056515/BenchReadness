import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getDemoSession } from "@/server/demoAuth";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const InjectSchema = z.object({
  interviewId: z.string().min(1),
  mode: z.enum(["SOFT_INJECT", "HARD_INJECT"]),
  question: z.string().min(5),
});

const FlagSchema = z.object({
  interviewId: z.string().min(1),
  note: z.string().min(3),
});

export default async function ObserverInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  const id = z.string().min(1).safeParse(p?.id).data;
  if (!id) redirect("/admin/review");
  const session = await getDemoSession();
  if (!session) redirect("/");

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      engineer: { include: { user: true } },
      jd: true,
      observerEvents: { orderBy: { createdAt: "desc" }, take: 25 },
    },
  });
  if (!interview) redirect("/admin/review");

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Observer monitor (MVP)</h1>
          <p className="mt-2 text-zinc-600">
            Interview: {interview.id} • Engineer: {interview.engineer.user.email ?? interview.engineer.userId} • JD:{" "}
            {interview.jd.title ?? interview.jd.id}
          </p>
        </div>
        <div className="flex gap-4">
          <Link className="underline" href={`/interview/${interview.id}`}>
            Candidate view
          </Link>
          <Link className="underline" href={`/admin/interviews/${interview.id}/review`}>
            Review
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="font-medium">Inject follow-up</div>
          <form action={inject} className="mt-4 grid gap-3">
            <input type="hidden" name="interviewId" value={interview.id} />
            <label className="grid gap-2 text-sm">
              Mode
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                name="mode"
                defaultValue="SOFT_INJECT"
              >
                <option value="SOFT_INJECT">Soft inject (queue)</option>
                <option value="HARD_INJECT">Hard inject (pivot)</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              Question
              <textarea
                className="min-h-[120px] rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                name="question"
                required
                placeholder="Type a follow-up question for the bot to ask…"
              />
            </label>
            <button
              className="rounded-full bg-foreground px-6 py-2 text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
              type="submit"
            >
              Queue inject
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="font-medium">Flag answer</div>
          <form action={flag} className="mt-4 grid gap-3">
            <input type="hidden" name="interviewId" value={interview.id} />
            <label className="grid gap-2 text-sm">
              Note
              <textarea
                className="min-h-[120px] rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                name="note"
                required
                placeholder="Flag this answer for post-interview review…"
              />
            </label>
            <button
              className="rounded-full bg-foreground px-6 py-2 text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
              type="submit"
            >
              Flag
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="font-medium">Events</div>
        <div className="mt-3 grid gap-2 text-sm text-zinc-600">
          {interview.observerEvents.length ? (
            interview.observerEvents.map((e) => (
              <div key={e.id} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{e.kind}</div>
                  <div className="text-xs text-zinc-500">{e.createdAt.toISOString()}</div>
                </div>
                <pre className="mt-2 max-h-28 overflow-auto text-xs">{e.payloadJson}</pre>
              </div>
            ))
          ) : (
            <div>No events yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

async function inject(formData: FormData) {
  "use server";
  const session = await getDemoSession();
  if (!session || (session.role !== "BENCH_MANAGER" && session.role !== "PRACTICE_LEAD")) redirect("/unauthorized");

  const parsed = InjectSchema.parse({
    interviewId: formData.get("interviewId"),
    mode: formData.get("mode"),
    question: formData.get("question"),
  });

  await prisma.observerEvent.create({
    data: {
      interviewId: parsed.interviewId,
      observerUserId: "demo",
      kind: parsed.mode,
      payloadJson: JSON.stringify({ question: parsed.question }, null, 2),
    },
  });

  redirect(`/observer/interview/${encodeURIComponent(parsed.interviewId)}`);
}

async function flag(formData: FormData) {
  "use server";
  const session = await getDemoSession();
  if (!session || session.role !== "BENCH_MANAGER") redirect("/unauthorized");

  const parsed = FlagSchema.parse({
    interviewId: formData.get("interviewId"),
    note: formData.get("note"),
  });

  await prisma.observerEvent.create({
    data: {
      interviewId: parsed.interviewId,
      observerUserId: "demo",
      kind: "FLAG_ANSWER",
      payloadJson: JSON.stringify({ note: parsed.note }, null, 2),
    },
  });

  redirect(`/observer/interview/${encodeURIComponent(parsed.interviewId)}`);
}

