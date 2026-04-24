import Link from "next/link";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { AppShell } from "@/app/components/AppShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateRubricSchema = z.object({
  roleType: z.string().min(2),
  level: z.string().min(2),
  version: z.string().min(1),
  definition: z.string().min(2),
});

export default async function TalentRubricsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const error = typeof sp["error"] === "string" ? sp["error"] : undefined;

  const rubrics = await prisma.rubricVersion.findMany({
    orderBy: [{ roleType: "asc" }, { level: "asc" }, { version: "desc" }],
    take: 200,
  });

  return (
    <AppShell title="Rubrics" subtitle="Versioned rubric definitions per role/level.">
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
          <div className="font-medium">Create rubric version</div>
          <form action={createRubric} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                Role type
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                  name="roleType"
                  required
                  placeholder="Backend Engineer"
                />
              </label>
              <label className="grid gap-2 text-sm">
                Level
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                  name="level"
                  required
                  placeholder="Senior"
                />
              </label>
              <label className="grid gap-2 text-sm md:col-span-2">
                Version (integer)
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                  name="version"
                  required
                  placeholder="1"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm">
              Definition (JSON or text)
              <textarea
                className="min-h-[180px] rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-black"
                name="definition"
                required
                placeholder='{"dimensions":{"TechnicalDepth":{"scale":"1-5","anchors":{}}}}'
              />
            </label>

            <button
              className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:bg-zinc-800 dark:hover:bg-zinc-200"
              type="submit"
            >
              Create
            </button>
          </form>
        </div>

        <div className="card p-5">
          <div className="font-medium">Rubric versions</div>
          <div className="mt-3 max-h-[520px] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                <tr>
                  <th className="p-3">Role</th>
                  <th className="p-3">Level</th>
                  <th className="p-3">Ver</th>
                  <th className="p-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {rubrics.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="p-3">{r.roleType}</td>
                    <td className="p-3">{r.level}</td>
                    <td className="p-3">{r.version}</td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">
                      {r.createdAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
                {rubrics.length === 0 ? (
                  <tr>
                    <td className="p-3 text-zinc-600" colSpan={4}>
                      No rubrics yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Next step: add an editor view and link rubrics to interviews by role/level.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

async function createRubric(formData: FormData) {
  "use server";

  const parsed = CreateRubricSchema.safeParse({
    roleType: formData.get("roleType"),
    level: formData.get("level"),
    version: formData.get("version"),
    definition: formData.get("definition"),
  });
  if (!parsed.success) {
    redirect(`/talent/rubrics?error=${encodeURIComponent("Invalid input")}`);
  }

  const version = Number(parsed.data.version);
  if (!Number.isFinite(version) || !Number.isInteger(version) || version < 1) {
    redirect(`/talent/rubrics?error=${encodeURIComponent("Version must be a positive integer")}`);
  }

  // Light JSON validation if user provided JSON.
  const def = parsed.data.definition.trim();
  if (def.startsWith("{") || def.startsWith("[")) {
    try {
      JSON.parse(def);
    } catch {
      redirect(`/talent/rubrics?error=${encodeURIComponent("Definition is not valid JSON")}`);
    }
  }

  try {
    await prisma.rubricVersion.create({
      data: {
        roleType: parsed.data.roleType,
        level: parsed.data.level,
        version,
        definition: def,
      },
    });
  } catch {
    redirect(`/talent/rubrics?error=${encodeURIComponent("Rubric already exists for that role/level/version")}`);
  }

  redirect("/talent/rubrics");
}

