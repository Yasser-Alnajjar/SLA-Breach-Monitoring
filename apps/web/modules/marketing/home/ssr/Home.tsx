import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { authOptions } from "@/lib/auth";
import { HomeView } from "../csr/HomeView";

/**
 * Reads the session directly (signed-in visitors are redirected to the
 * dashboard) so that lookup stays out of the "use client" view below.
 */
export const Home = async () => {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <HomeView />
      <SiteFooter />
    </div>
  );
};
