import Link from "next/link";
import { prisma } from "@/server/db";
import { z } from "zod";
import { redirect } from "next/navigation";
import { getDemoSession } from "@/server/demoAuth";
import { AppShell } from "@/app/components/AppShell";

const CreateAssessmentSchema = z.object({
  engineerEmail: z.string().email(),
  engineerName: z.string().min(1).optional().or(z.literal("")),
  jdTitle: z.string().min(1),
  jdText: z.string().min(50),
  focusAreas: z.string().optional().or(z.literal("")),
  resumeSummary: z.string().optional().or(z.literal("")),
});

/** Prefill in `next dev` only so local testing is one-click; production forms stay blank. */
const SETUP_DEV_DEFAULTS =
  process.env.NODE_ENV === "development"
    ? {
        engineerEmail: "demo.engineer@example.com",
        engineerName: "Alex Demo",
        jdTitle: "Senior Backend Engineer",
        jdText: [
          "Build and operate services for our core platform. You will design APIs, own data consistency,",
          "and improve reliability (SLOs, incident response, postmortems).",
          "",
          "Requirements: 5+ years backend (Go or Java), strong SQL, experience with event-driven systems,",
          "Kafka or similar, Docker/Kubernetes, and clear written communication for client-facing work.",
        ].join("\n"),
        focusAreas: "Event-driven systems, Kafka, API design, observability",
        resumeSummary: [
          "8+ yrs backend: Java/Spring, Kafka, Postgres. Led payments platform migration, on-call rotation,",
          "mentored 4 engineers. Recent: event-sourced ledger service, SLO-driven reliability.",
        ].join(" "),
      }
    : null;

export default async function AdminSetupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const createdId = typeof sp["created"] === "string" ? sp["created"] : undefined;
  const error = typeof sp["error"] === "string" ? sp["error"] : undefined;

  return (
    <AppShell
      title="Setup assessment"
      subtitle="Paste the target JD + engineer email. Generates a technical-first 10-slot plan (communication + technical knowledge) and creates an interview link."
    >

      {createdId ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <div className="font-medium">Interview created</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link className="underline" href={`/interview/${createdId}`}>
              Open interview
            </Link>
            <Link className="underline" href={`/admin/interviews/${createdId}/review`}>
              Open review
            </Link>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">{error}</div>
      ) : null}

      {SETUP_DEV_DEFAULTS ? (
        <p className="mt-4 text-sm text-zinc-500">
          Development mode: fields are prefilled with sample data so you can submit immediately.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black">
      <form action={createAssessment} className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Engineer email</label>
          <input
            className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
            name="engineerEmail"
            type="email"
            required
            placeholder="engineer@company.com"
            defaultValue={SETUP_DEV_DEFAULTS?.engineerEmail}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Engineer name (optional)</label>
          <input
            className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
            name="engineerName"
            type="text"
            placeholder="Name"
            defaultValue={SETUP_DEV_DEFAULTS?.engineerName}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">JD title</label>
          <input
            className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
            name="jdTitle"
            type="text"
            required
            placeholder="Senior Backend Engineer"
            defaultValue={SETUP_DEV_DEFAULTS?.jdTitle}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">JD text (paste)</label>
          <textarea
            className="min-h-[220px] rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
            name="jdText"
            required
            minLength={50}
            placeholder="Paste job description here…"
            defaultValue={SETUP_DEV_DEFAULTS?.jdText}
          />
          <p className="text-xs text-zinc-500">Minimum 50 characters for MVP validation.</p>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Special focus areas (optional)</label>
          <input
            className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
            name="focusAreas"
            type="text"
            placeholder='e.g., "event-driven systems, Kafka"'
            defaultValue={SETUP_DEV_DEFAULTS?.focusAreas}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Resume / experience summary (optional, for AI)</label>
          <textarea
            className="min-h-[120px] rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
            name="resumeSummary"
            placeholder="Paste a short resume summary or key bullets—used for human-like follow-ups and post-interview AI scoring against the JD."
            defaultValue={SETUP_DEV_DEFAULTS?.resumeSummary}
          />
          <p className="text-xs text-zinc-500">
            Stored with the interview plan. The interviewer model uses it to probe claims; completion runs AI scoring vs
            JD + this text when <span className="font-medium">OPENAI_API_KEY</span> is set.
          </p>
        </div>

        <div className="pt-2">
          <button
            className="rounded-full bg-foreground px-6 py-2 text-sm font-medium text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
            type="submit"
          >
            Create interview
          </button>
        </div>
      </form>
      </div>
    </AppShell>
  );
}

async function createAssessment(formData: FormData) {
  "use server";

  const session = await getDemoSession();
  if (!session || (session.role !== "BENCH_MANAGER" && session.role !== "PRACTICE_LEAD" && session.role !== "TALENT")) {
    redirect("/unauthorized");
  }

  const parsedResult = CreateAssessmentSchema.safeParse({
    engineerEmail: formData.get("engineerEmail"),
    engineerName: formData.get("engineerName"),
    jdTitle: formData.get("jdTitle"),
    jdText: formData.get("jdText"),
    focusAreas: formData.get("focusAreas"),
    resumeSummary: formData.get("resumeSummary"),
  });
  if (!parsedResult.success) {
    const msg =
      parsedResult.error.flatten().fieldErrors.jdText?.[0] ??
      "Invalid input. Please check the form and try again.";
    redirect(`/admin/setup?error=${encodeURIComponent(msg)}`);
  }
  const parsed = parsedResult.data;

  const user = await prisma.user.upsert({
    where: { email: parsed.engineerEmail },
    update: { name: parsed.engineerName || undefined, role: "ENGINEER" },
    create: { email: parsed.engineerEmail, name: parsed.engineerName || undefined, role: "ENGINEER" },
  });

  const engineer = await prisma.engineer.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const jd = await prisma.jobDescription.create({
    data: {
      title: parsed.jdTitle,
      source: "paste",
      text: parsed.jdText,
    },
  });

  const slots = [
    { slot: 1, theme: "Technical opener (JD-aligned)", difficulty: "medium", minutes: 7 },
    { slot: 2, theme: "Architecture / design trade-offs", difficulty: "medium", minutes: 7 },
    { slot: 3, theme: "Implementation & correctness", difficulty: "medium", minutes: 7 },
    { slot: 4, theme: "Data, consistency, or performance", difficulty: "medium", minutes: 7 },
    { slot: 5, theme: "Production operations & observability", difficulty: "medium", minutes: 7 },
    { slot: 6, theme: "Failures, incidents, hardening", difficulty: "hard", minutes: 8 },
    { slot: 7, theme: "System / API design scenario", difficulty: "hard", minutes: 10 },
    { slot: 8, theme: "Algorithms & reasoning", difficulty: "hard", minutes: 10 },
    { slot: 9, theme: "Technical explanation & clarity", difficulty: "medium", minutes: 6 },
    { slot: 10, theme: "Ambiguous spec — technical narrowing", difficulty: "medium", minutes: 6 },
  ];

  const plan = await prisma.interviewPlan.create({
    data: {
      engineerId: engineer.id,
      jdId: jd.id,
      slotsJson: JSON.stringify({ slots, focusAreas: parsed.focusAreas || undefined }),
      gapMapJson: JSON.stringify({
        jdTitle: parsed.jdTitle,
        inferredGaps: [] as string[],
        resumeSummary: parsed.resumeSummary?.trim() || undefined,
      }),
      createdByUserId: user.id,
    },
  });

  const interview = await prisma.interview.create({
    data: {
      engineerId: engineer.id,
      jdId: jd.id,
      planId: plan.id,
      status: "SCHEDULED",
      scheduledAt: new Date(),
    },
  });

  redirect(`/admin/setup?created=${encodeURIComponent(interview.id)}`);
}

