import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  return (
    <main className="dashboard">
      <h1>Dashboard</h1>
      <p>Signed in as {session.user.email}.</p>
      <p>
        The at-risk list, breach counts, and compliance dashboard described in
        the roadmap land in step 9.
      </p>
    </main>
  );
}
