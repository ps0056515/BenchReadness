import { getDemoSession } from "@/server/demoAuth";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await getDemoSession();
  if (!session) {
    redirect("/");
  }

  const role = session.role;
  const target =
    role === "ENGINEER"
      ? "/engineer"
      : role === "BENCH_MANAGER"
        ? "/admin"
        : role === "TALENT"
          ? "/talent"
          : role === "PRACTICE_LEAD"
            ? "/practice"
            : "/compliance";
  redirect(target);
}

