import type { LucideIcon } from "lucide-react";

export interface MarketingFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface MarketingStep {
  number: string;
  title: string;
  description: string;
}

export interface MarketingPrinciple {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface PricingPlan {
  name: string;
  price: string;
  cadence: string;
  description: string;
  cta: string;
  href: string;
  highlighted: boolean;
  features: string[];
}

export interface PricingFaq {
  question: string;
  answer: string;
}
