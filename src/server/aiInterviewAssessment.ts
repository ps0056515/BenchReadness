import { z } from "zod";
import type { ReadinessVerdict } from "@/generated/prisma";

const AssessmentSchema = z.object({
  technicalKnowledge: z.object({
    score: z.number().min(1).max(5),
    rationale: z.string().min(1),
  }),
  communication: z.object({
    score: z.number().min(1).max(5),
    rationale: z.string().min(1),
  }),
  proposedVerdict: z.enum(["READY", "NEEDS_1_WEEK_PREP", "NEEDS_RESKILLING", "MISMATCH_WITH_JD"]),
  summary: z.string().min(1),
  strengths: z.array(z.string()).optional(),
  gaps: z.array(z.string()).optional(),
});

export type AiAssessmentPayload = z.infer<typeof AssessmentSchema>;

export type UtteranceTurn = { speaker: string; text: string; at?: string };

function parseUtterances(transcriptJson: string): UtteranceTurn[] {
  try {
    const doc = JSON.parse(transcriptJson) as { utterances?: UtteranceTurn[] };
    return Array.isArray(doc.utterances) ? doc.utterances : [];
  } catch {
    return [];
  }
}

function heuristicAssessment(utterances: UtteranceTurn[]): AiAssessmentPayload {
  const candidateText = utterances
    .filter((u) => u.speaker === "CANDIDATE")
    .map((u) => u.text)
    .join(" ");
  const depth = Math.min(5, 1 + Math.floor(candidateText.length / 400));
  const comm = Math.min(5, 1 + Math.floor(utterances.filter((u) => u.speaker === "CANDIDATE").length));
  return {
    technicalKnowledge: {
      score: Math.max(1, Math.min(5, depth)),
      rationale:
        "Heuristic only (no OPENAI_API_KEY): score scales lightly with length of candidate replies. Re-run with API key for JD/resume-grounded scoring.",
    },
    communication: {
      score: Math.max(1, Math.min(5, comm)),
      rationale:
        "Heuristic only: based on number of candidate turns. Configure OPENAI_API_KEY for real assessment.",
    },
    proposedVerdict: "NEEDS_1_WEEK_PREP",
    summary:
      "Automatic AI assessment was not available. Add OPENAI_API_KEY to score against the JD and resume text you provided at setup.",
    strengths: [],
    gaps: ["Enable OpenAI for evidence-based scoring against JD and resume."],
  };
}

export async function assessInterviewWithAi(args: {
  jdTitle: string;
  jdText: string;
  resumeSummary?: string;
  candidateLabel?: string;
  transcriptJson: string;
}): Promise<{ payload: AiAssessmentPayload; source: "openai" | "heuristic" }> {
  const utterances = parseUtterances(args.transcriptJson);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { payload: heuristicAssessment(utterances), source: "heuristic" };
  }

  const dialogue = utterances
    .map((u) => `${u.speaker === "BOT" || u.speaker === "Interviewer" ? "Interviewer" : "Candidate"}: ${u.text}`)
    .join("\n")
    .slice(0, 24000);

  const model = process.env.AI_MODEL ?? "gpt-4o-mini";

  const system = [
    "You are an expert technical hiring assessor.",
    "You must read the job description (JD), optional resume summary, and the interview transcript.",
    "Score ONLY two dimensions on 1–5: TechnicalKnowledge (depth, correctness, relevance to JD) and Communication (clarity, structure, listening, precision).",
    "Ground every score in specific evidence from the transcript—what they said, what was weak, what matched the JD.",
    "proposedVerdict must align with evidence: READY only if both scores are strong and JD fit is credible; MISMATCH_WITH_JD if answers diverge from role needs; NEEDS_RESKILLING for major knowledge gaps; else NEEDS_1_WEEK_PREP for mixed signals.",
    "Return ONLY valid JSON matching the schema in the user message—no markdown fences, no commentary.",
  ].join("\n");

  const user = [
    "Return JSON with exactly these keys:",
    '{"technicalKnowledge":{"score":1-5,"rationale":"string"},"communication":{"score":1-5,"rationale":"string"},"proposedVerdict":"READY|NEEDS_1_WEEK_PREP|NEEDS_RESKILLING|MISMATCH_WITH_JD","summary":"2-4 sentences overall","strengths":["optional bullets"],"gaps":["optional bullets against JD"]}',
    "",
    `JD title: ${args.jdTitle}`,
    `JD body:\n${args.jdText.slice(0, 12000)}`,
    args.resumeSummary ? `Resume / experience summary (from setup):\n${args.resumeSummary.slice(0, 8000)}` : "",
    args.candidateLabel ? `Candidate label: ${args.candidateLabel}` : "",
    "",
    "Transcript:",
    dialogue || "(empty—score conservatively and explain)",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        max_tokens: 900,
      }),
    });
    if (!res.ok) {
      return { payload: heuristicAssessment(utterances), source: "heuristic" };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return { payload: heuristicAssessment(utterances), source: "heuristic" };
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return { payload: heuristicAssessment(utterances), source: "heuristic" };
    }
    const parsed = AssessmentSchema.safeParse(json);
    if (!parsed.success) {
      return { payload: heuristicAssessment(utterances), source: "heuristic" };
    }
    return { payload: parsed.data, source: "openai" };
  } catch {
    return { payload: heuristicAssessment(utterances), source: "heuristic" };
  }
}

export function mergeTranscriptWithAssessment(transcriptJson: string, assessment: AiAssessmentPayload, source: string) {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(transcriptJson) as Record<string, unknown>;
  } catch {
    doc = { utterances: [], meta: {} };
  }
  const prevMeta =
    doc.meta && typeof doc.meta === "object" && doc.meta !== null ? (doc.meta as Record<string, unknown>) : {};
  doc.meta = {
    ...prevMeta,
    aiAssessment: { ...assessment, scoredAt: new Date().toISOString(), source },
  };
  return JSON.stringify(doc, null, 2);
}

export function verdictForPrisma(v: AiAssessmentPayload["proposedVerdict"]): ReadinessVerdict {
  return v as ReadinessVerdict;
}
