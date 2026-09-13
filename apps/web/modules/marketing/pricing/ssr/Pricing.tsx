import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { PricingView } from "../csr/PricingView";

export const Pricing = async () => {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <PricingView />
      <SiteFooter />
    </div>
  );
};
