import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { HomeView } from "../csr/HomeView";

/**
 * Reads the session directly (signed-in visitors are redirected to the
 * dashboard) so that lookup stays out of the "use client" view below.
 */
export const Home = async () => {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <HomeView />
      <SiteFooter />
    </div>
  );
};
