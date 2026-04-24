import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getDemoSession } from "@/server/demoAuth";
import {
  assessInterviewWithAi,
  mergeTranscriptWithAssessment,
  verdictForPrisma,
} from "@/server/aiInterviewAssessment";
import { z } from "zod";
import { VoiceInterviewForm } from "./VoiceInterviewForm";
import { InterviewPlanPanel } from "./InterviewPlanPanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CompleteSchema = z.object({
  interviewId: z.string().min(1),
  candidateNotes: z.string().optional().or(z.literal("")),
  transcriptJson: z.string().optional().or(z.literal("")),
});

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  const id = z.string().min(1).safeParse(p?.id).data;
  if (!id) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-zinc-600">Missing interview id in URL.</p>
      </div>
    );
  }
  const session = await getDemoSession();

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { engineer: { include: { user: true } }, jd: true, plan: true },
  });

  if (!interview) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-zinc-600">Interview does not exist.</p>
      </div>
    );
  }

  // Basic guard: only the engineer themselves (or a manager) can open.
  const isOwner = session?.role === "ENGINEER";
  const isManager = session?.role === "BENCH_MANAGER" || session?.role === "PRACTICE_LEAD";
  if (!isOwner && !isManager) redirect("/unauthorized");

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Live interview (MVP shell)</h1>
          <p className="mt-2 text-zinc-600">
            JD: {interview.jd.title ?? interview.jd.id} • Status: {interview.status}
          </p>
        </div>
        <div className="flex gap-4">
          <Link className="underline" href={`/observer/interview/${interview.id}`}>
            Observer
          </Link>
          <Link className="underline" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <InterviewPlanPanel slotsJson={interview.plan?.slotsJson ?? null} />

        <VoiceInterviewForm
          interviewId={interview.id}
          jdTitle={interview.jd.title ?? "Target role"}
          completeInterview={completeInterview}
        />
      </div>
    </div>
  );
}

async function completeInterview(formData: FormData) {
  "use server";

  const session = await getDemoSession();
  if (!session) redirect("/");

  const parsed = CompleteSchema.parse({
    interviewId: formData.get("interviewId"),
    candidateNotes: formData.get("candidateNotes"),
    transcriptJson: formData.get("transcriptJson"),
  });

  const fallbackTranscript = {
    meta: { generated: true, at: new Date().toISOString() },
    notes: parsed.candidateNotes || undefined,
    utterances: [
      { speaker: "BOT", text: "Thanks for joining. Start with a quick intro.", at: new Date().toISOString() },
      { speaker: "CANDIDATE", text: "I’m a backend engineer focused on APIs and systems.", at: new Date().toISOString() },
    ],
  };
  const transcriptJson =
    parsed.transcriptJson && parsed.transcriptJson.trim().length > 0
      ? parsed.transcriptJson
      : JSON.stringify(fallbackTranscript, null, 2);

  const interview = await prisma.interview.findUnique({
    where: { id: parsed.interviewId },
    include: { jd: true, plan: true, engineer: { include: { user: true } } },
  });
  if (!interview) redirect("/admin/setup?error=Interview%20not%20found");

  let resumeSummary: string | undefined;
  try {
    const g = JSON.parse(interview.plan?.gapMapJson ?? "{}") as { resumeSummary?: string };
    resumeSummary = typeof g.resumeSummary === "string" && g.resumeSummary.trim() ? g.resumeSummary.trim() : undefined;
  } catch {
    resumeSummary = undefined;
  }

  const candidateLabel =
    [interview.engineer?.user?.name, interview.engineer?.user?.email].filter(Boolean).join(" · ") || undefined;

  const { payload, source } = await assessInterviewWithAi({
    jdTitle: interview.jd.title ?? "Target role",
    jdText: interview.jd.text ?? "",
    resumeSummary,
    candidateLabel,
    transcriptJson,
  });

  const transcriptWithAssessment = mergeTranscriptWithAssessment(transcriptJson, payload, source);

  await prisma.interview.update({
    where: { id: parsed.interviewId },
    data: {
      status: "REVIEW_PENDING",
      endedAt: new Date(),
      transcriptJson: transcriptWithAssessment,
      proposedVerdict: verdictForPrisma(payload.proposedVerdict),
      scores: {
        deleteMany: {},
        create: [
          {
            dimension: "TechnicalKnowledge",
            value: payload.technicalKnowledge.score,
            rationale: payload.technicalKnowledge.rationale,
          },
          {
            dimension: "Communication",
            value: payload.communication.score,
            rationale: payload.communication.rationale,
          },
        ],
      },
    },
  });

  redirect(`/admin/interviews/${encodeURIComponent(parsed.interviewId)}/review`);
}

