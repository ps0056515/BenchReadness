import { z } from "zod";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

const BodySchema = z.object({
  slot: z.number().int().min(1).max(10),
  lastAnswer: z.string().optional().or(z.literal("")),
  utterances: z
    .array(
      z.object({
        speaker: z.enum(["BOT", "CANDIDATE"]),
        text: z.string(),
        at: z.string(),
      }),
    )
    .optional(),
});

type PlanSlot = { slot: number; theme: string; difficulty: string; minutes: number };

function parseInterviewPlan(slotsJson: string | null): {
  focusAreas?: string;
  getSlot: (n: number) => PlanSlot | undefined;
} {
  if (!slotsJson) {
    return { getSlot: () => undefined };
  }
  try {
    const p = JSON.parse(slotsJson) as { focusAreas?: string; slots?: PlanSlot[] };
    const byNum = new Map<number, PlanSlot>();
    for (const s of p.slots ?? []) {
      if (typeof s?.slot === "number" && s.theme) {
        byNum.set(s.slot, s);
      }
    }
    return {
      focusAreas: typeof p.focusAreas === "string" && p.focusAreas.trim() ? p.focusAreas.trim() : undefined,
      getSlot: (n) => byNum.get(n),
    };
  } catch {
    return { getSlot: () => undefined };
  }
}

function parseGapMap(gapJson: string | null): { resumeSummary?: string } {
  if (!gapJson) return {};
  try {
    const g = JSON.parse(gapJson) as { resumeSummary?: string };
    const r = g.resumeSummary;
    return { resumeSummary: typeof r === "string" && r.trim() ? r.trim() : undefined };
  } catch {
    return {};
  }
}

function extractKeywords(jdText: string): string[] {
  const words = jdText
    .toLowerCase()
    .replace(/[^a-z0-9\s#+.-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && w.length <= 18);
  const stop = new Set([
    "with",
    "that",
    "this",
    "your",
    "have",
    "will",
    "from",
    "they",
    "them",
    "when",
    "where",
    "able",
    "work",
    "role",
    "years",
    "experience",
    "skills",
    "engineer",
    "senior",
    "develop",
    "design",
    "build",
    "using",
  ]);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}

/** When there is no LLM, still sound answer-aware using the last reply. */
function fallbackQuestion(
  slot: number,
  jdTitle: string,
  jdText: string,
  plan: ReturnType<typeof parseInterviewPlan>,
  lastAnswer: string,
): string {
  const kws = extractKeywords(jdText);
  const focus = plan.focusAreas;
  const theme = plan.getSlot(slot)?.theme;
  const la = lastAnswer.trim();
  const hasSubstance = la.length > 25;
  const domainHint = kws.length ? `Themes to stress: ${kws.slice(0, 3).join(", ")}.` : "";

  if (slot === 1 && !hasSubstance) {
    const bits = [focus ? `Focus areas: ${focus}.` : "", domainHint].filter(Boolean).join(" ");
    return `We’ll start technical right away for ${jdTitle}.${bits ? ` ${bits}` : ""} First question: pick one concrete stack, subsystem, or pattern this role would lean on heavily—then walk me through how you’ve actually built or operated it, including constraints, failure modes you hit, and how you validated correctness.`;
  }

  if (hasSubstance) {
    const focusBit = focus ? ` (${focus} is on our radar for this role if it fits.)` : "";
    const variants: Record<number, string[]> = {
      2: [
        `Okay, I’m with you. From what you just said—what was the single hardest call you had to make there, and what would you have done differently with perfect hindsight?`,
        `That’s useful context. Staying on that thread: who was the “customer” for that work (internal or external), and how did you prove it was actually working?`,
      ],
      3: [
        `Got it. You mentioned a few moving parts—if I zoom in on one of them, what broke or got messy in practice, and how did you notice?`,
        `Thanks. What did you personally own versus what you delegated or paired on, and how did you keep quality from slipping?`,
      ],
      4: [
        `Fair. Let me connect that to how we’d work day to day: what’s one technical idea from your world that you’d want a new teammate to understand quickly—plain language, where it breaks, and when not to use it?${focusBit}`,
        `I’m trying to map what you said to how we build here. What’s a concept you’d defend in design review, and what’s the main pushback you’d expect?${focusBit}`,
      ],
      5: [
        `Makes sense. If that had to ship next week with half the time, what would you cut, what would you absolutely not cut, and how would you de-risk it?`,
        `Right—so operationally, how would you monitor that in prod, and what’s the first alert you’d want to wake you up?`,
      ],
      6: [
        `Let’s stress-test it a bit: what’s an edge case or failure mode that would worry you, and what’s your mitigation?`,
        `What’s the worst thing that actually happened in something like that, and what did you change afterward?`,
      ],
      7: [
        `If we sketched a system for a problem like the one you described—what are the main boxes and arrows, and where’s the riskiest integration?`,
        `Walk me through how data would flow end to end for that scenario, and where you’d expect pain first.`,
      ],
      8: [
        `Thinking out loud like we’re at a whiteboard: pick a concrete problem in that space and outline how you’d approach it—inputs, output, rough complexity, and how you’d test it.`,
        `What’s a bug or subtle mistake someone could make in that kind of solution, and how would you catch it before prod?`,
      ],
      9: [
        `Staying technical: pick something non-trivial you’ve explained to another engineer—how did you structure it so they actually understood, and what misunderstanding did you have to correct?`,
        `How do you sanity-check your own mental model before you code—what do you write down, sketch, or spike when the problem is fuzzy?`,
      ],
      10: [
        `Last one: someone hands you a one-line “requirement” that’s underspecified—how do you narrow it to a testable technical spec without stalling the team?`,
        `How do you surface technical risk to partners when you’re still uncertain—what do you say, and what evidence do you bring?`,
      ],
    };
    const list = variants[slot] ?? variants[4]!;
    const idx = la.length % list.length;
    return list[idx] ?? list[0]!;
  }

  const themeBit = theme ? ` (${theme})` : "";
  const domainHintForSlot = kws.length ? ` We care about depth in things like ${kws.slice(0, 3).join(", ")}.` : "";

  switch (slot) {
    case 2:
      return `Good.${themeBit} Walk me through one recent project you owned—problem, what you built, and how you knew it worked.${focus ? ` If it helps, we’re curious about ${focus}.` : ""}`;
    case 3:
      return `Let’s go somewhere different from that example.${themeBit} Another situation where you had to trade off speed versus correctness—how did you decide?`;
    case 4:
      return `Concept check${themeBit}.${domainHintForSlot} Explain one technical idea you’d want a peer to understand quickly—where it shines and where it falls apart.`;
    case 5:
      return `If that idea had to run in production tomorrow${themeBit}, how would you roll it out and what would you watch first?`;
    case 6:
      return `Stress test${themeBit}: an edge case or incident angle—what breaks first, and how do you harden it?`;
    case 7:
      return `Scenario${themeBit}: sketch the shape of a system that fits what we’ve been discussing—components, data flow, main risk.`;
    case 8:
      return `Reasoning${themeBit}: a concrete problem in this space—your approach, complexity, tests.`;
    case 9:
      return `Communication under load${themeBit}: explain a tricky technical trade-off as you would to a sharp but rushed peer—what you optimize for first, and what you defer.`;
    default:
      return `Closing${themeBit}: vague ask on paper—how you turn it into a concrete technical plan of attack and checkpoints.`;
  }
}

async function llmQuestion(args: {
  slot: number;
  jdTitle: string;
  jdText: string;
  lastAnswer: string;
  utterances: Array<{ speaker: "BOT" | "CANDIDATE"; text: string }>;
  plan: ReturnType<typeof parseInterviewPlan>;
  resumeSummary?: string;
  candidateHint?: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const planSlot = args.plan.getSlot(args.slot);
  const theme = planSlot?.theme ?? "Interview segment";

  const system = [
    "You are a skilled human technical interviewer in a live conversation—warm, curious, and adaptive like a strong staff+ engineer running a loop.",
    "Your entire reply must be exactly ONE natural next question (one or two short sentences). No filler like “Great” or “Sure” on its own—work warmth into the question itself if you want.",
    "Primary job: react to what the candidate literally just said. Reference specifics they gave (systems, tools, metrics, trade-offs). If they were vague, ask one friendly, concrete technical probe—not a lecture.",
    "Use the resume summary (if provided) only to probe depth, consistency with what they claim, and fit to the JD—never read it back as a bullet list.",
    "Secondary job: keep the interview roughly aligned with the segment theme and role—but never sound like you’re checking boxes. Do not read, quote, summarize, or bullet the job description.",
    "Skip long biography or “tell me about yourself” warm-ups unless they already answered and you need one bridging clause. Prefer sharp technical follow-ups.",
    "Evaluators score only technical knowledge and communication (clarity, structure, precision)—every question should probe those, not generic “culture” or unrelated soft skills.",
    "Sound like a normal person: contractions are fine, avoid stiff corporate phrasing, avoid numbered lists in your question.",
  ].join("\n");

  const recent = args.utterances
    .slice(-14)
    .map((u) => `${u.speaker === "BOT" ? "Interviewer" : "Candidate"}: ${u.text}`)
    .join("\n");

  const last = args.lastAnswer.trim();
  const jdDigest =
    last.length > 80 ? args.jdText.slice(0, 900) : args.jdText.slice(0, 1200);

  const user = [
    last
      ? `What they just said (this is your main hook—base your question on it):\n${last.slice(0, 3500)}`
      : "(No prior answer yet—this is the opening of the conversation.)",
    recent ? `Full dialogue so far (for context only):\n${recent}` : "",
    `Rough interview phase: segment ${args.slot} — “${theme}”. Use this as background; do not announce the phase name unless it sounds human.`,
    `Role label (internal, do not recite as JD): ${args.jdTitle}`,
    args.candidateHint ? `Candidate: ${args.candidateHint}` : "",
    args.resumeSummary
      ? `Resume / experience summary (for your reference—probe, do not recite):\n${args.resumeSummary.slice(0, 4000)}`
      : "",
    args.plan.focusAreas ? `Things we care about for this practice: ${args.plan.focusAreas}` : "",
    "JD (internal context only—never repeat verbatim; use only to avoid absurd mismatches):",
    jdDigest || "(none)",
    last
      ? "Ask your next question now. It must clearly follow from their last answer."
      : "Ask your opening question now: go straight to a substantive technical question tied to this role and JD—no career narrative, no ‘walk me through your resume’, no job-description recap. One or two sentences max.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 200,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  return text.replace(/^["'\s]+|["'\s]+$/g, "");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const p = await params;
  const id = z.string().min(1).safeParse(p?.id).data;
  if (!id) return Response.json({ error: "Missing interview id" }, { status: 400 });

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid body" }, { status: 400 });

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { jd: true, plan: true, engineer: { include: { user: true } } },
  });
  if (!interview) return Response.json({ error: "Not found" }, { status: 404 });

  const jdTitle = interview.jd.title ?? "Target role";
  const jdText = interview.jd.text ?? "";
  const plan = parseInterviewPlan(interview.plan?.slotsJson ?? null);
  const gap = parseGapMap(interview.plan?.gapMapJson ?? null);
  const candidateHint =
    [interview.engineer?.user?.name, interview.engineer?.user?.email].filter(Boolean).join(" · ") || undefined;

  const utterances =
    body.data.utterances?.map((u) => ({ speaker: u.speaker, text: u.text })) ?? [];

  const question =
    (await llmQuestion({
      slot: body.data.slot,
      jdTitle,
      jdText,
      lastAnswer: body.data.lastAnswer ?? "",
      utterances,
      plan,
      resumeSummary: gap.resumeSummary,
      candidateHint,
    })) ?? fallbackQuestion(body.data.slot, jdTitle, jdText, plan, body.data.lastAnswer ?? "");

  return Response.json({ question });
}
