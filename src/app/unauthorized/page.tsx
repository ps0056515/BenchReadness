import Link from "next/link";
import { getDemoSession } from "@/server/demoAuth";

export default async function Unauthorized() {
  const session = await getDemoSession();
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Not authorized</h1>
      <p className="mt-2 text-zinc-600">
        {session
          ? `Your role (${session.role}) doesn’t have access to this area.`
          : "You’re not signed in."}
      </p>
      <p className="mt-4">
        <Link className="underline" href="/dashboard">
          Go to dashboard
        </Link>
      </p>
    </div>
  );
}

