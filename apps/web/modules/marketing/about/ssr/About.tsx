import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { AboutView } from "../csr/AboutView";

export const About = async () => {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <AboutView />
      <SiteFooter />
    </div>
  );
};
