import Link from "next/link";
import { prisma } from "@/server/db";
import { AppShell } from "@/app/components/AppShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminReviewList() {
  const interviews = await prisma.interview.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      engineer: { include: { user: true } },
      jd: true,
    },
  });

  return (
    <AppShell title="Review & sign-off" subtitle="Latest interviews (most recent first).">
      <div className="mb-4">
        <Link className="underline text-sm" href="/admin">
          ← Back
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th className="p-3">Engineer</th>
              <th className="p-3">JD</th>
              <th className="p-3">Status</th>
              <th className="p-3">Verdict</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((i) => (
              <tr key={i.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="p-3">{i.engineer.user.email ?? i.engineer.user.name ?? i.engineer.userId}</td>
                <td className="p-3">{i.jd.title ?? i.jd.id}</td>
                <td className="p-3">{i.status}</td>
                <td className="p-3">{i.finalVerdict ?? i.proposedVerdict ?? "-"}</td>
                <td className="p-3 text-right">
                  <Link className="underline" href={`/admin/interviews/${i.id}/review`}>
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {interviews.length === 0 ? (
              <tr>
                <td className="p-3 text-zinc-600" colSpan={5}>
                  No interviews yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

