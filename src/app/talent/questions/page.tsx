import Link from "next/link";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { AppShell } from "@/app/components/AppShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateQuestionSchema = z.object({
  prompt: z.string().min(10),
  skillTrack: z.string().optional().or(z.literal("")),
  level: z.string().optional().or(z.literal("")),
  slot: z.string().optional().or(z.literal("")),
  theme: z.string().optional().or(z.literal("")),
});

export default async function TalentQuestionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const error = typeof sp["error"] === "string" ? sp["error"] : undefined;

  const questions = await prisma.question.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { variants: true },
  });

  return (
    <AppShell title="Question bank" subtitle="Curated questions and variants for interview slots.">
      <div className="mb-4">
        <Link className="underline text-sm" href="/talent">
          ← Back
        </Link>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="font-medium">Add question</div>
          <form action={createQuestion} className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm">
              Prompt
              <textarea
                className="min-h-[120px] rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                name="prompt"
                required
                minLength={10}
                placeholder="Write the question prompt…"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                Skill track
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                  name="skillTrack"
                  placeholder="backend"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Level
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                  name="level"
                  placeholder="senior"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Slot (1–10)
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                  name="slot"
                  placeholder="7"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Theme
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                  name="theme"
                  placeholder="system design"
                />
              </label>
            </div>
            <button
              className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
              type="submit"
            >
              Create
            </button>
          </form>
        </div>

        <div className="card p-5">
          <div className="font-medium">Questions</div>
          <div className="mt-3 max-h-[520px] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                <tr>
                  <th className="p-3">Prompt</th>
                  <th className="p-3">Meta</th>
                  <th className="p-3 text-right">Variants</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                    <td className="p-3">
                      <div className="line-clamp-3">{q.prompt}</div>
                      <div className="mt-2 text-xs text-zinc-500">{q.id}</div>
                    </td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">
                      <div>track: {q.skillTrack ?? "-"}</div>
                      <div>level: {q.level ?? "-"}</div>
                      <div>slot: {q.slot ?? "-"}</div>
                      <div>theme: {q.theme ?? "-"}</div>
                    </td>
                    <td className="p-3 text-right">{q.variants.length}</td>
                  </tr>
                ))}
                {questions.length === 0 ? (
                  <tr>
                    <td className="p-3 text-zinc-600" colSpan={3}>
                      No questions yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Next step: add per-question variant CRUD and tagging.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

async function createQuestion(formData: FormData) {
  "use server";

  const parsedResult = CreateQuestionSchema.safeParse({
    prompt: formData.get("prompt"),
    skillTrack: formData.get("skillTrack"),
    level: formData.get("level"),
    slot: formData.get("slot"),
    theme: formData.get("theme"),
  });

  if (!parsedResult.success) {
    redirect(`/talent/questions?error=${encodeURIComponent("Invalid input")}`);
  }

  const slotNumRaw = parsedResult.data.slot?.trim() ?? "";
  const slotNum = slotNumRaw ? Number(slotNumRaw) : null;
  if (
    slotNumRaw &&
    (slotNum === null || !Number.isFinite(slotNum) || slotNum < 1 || slotNum > 10)
  ) {
    redirect(`/talent/questions?error=${encodeURIComponent("Slot must be a number from 1 to 10")}`);
  }

  await prisma.question.create({
    data: {
      prompt: parsedResult.data.prompt,
      skillTrack: parsedResult.data.skillTrack || null,
      level: parsedResult.data.level || null,
      slot: slotNum ? Math.trunc(slotNum) : null,
      theme: parsedResult.data.theme || null,
    },
  });

  redirect("/talent/questions");
}

