"use client";

import { SettingsSectionHeader } from "@/components/settings/section-header";
import { Reveal } from "@/components/shared/reveal";
import type { IUser } from "@/lib/types/user";
import { AppearanceCard } from "./AppearanceCard";
import { EmailCard } from "./EmailCard";
import { ProfileInformationCard } from "./ProfileInformationCard";
import { SecurityCard } from "./SecurityCard";

interface ProfileViewProps {
  user: IUser;
}

export const ProfileView = ({ user }: ProfileViewProps) => {
  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        eyebrow="Your account"
        title="Profile"
        description="Manage your personal profile information and preferences."
      />

      <Reveal delay={0}>
        <ProfileInformationCard user={user} />
      </Reveal>

      <Reveal delay={0.05}>
        <EmailCard user={user} />
      </Reveal>

      <Reveal delay={0.1}>
        <AppearanceCard />
      </Reveal>

      <Reveal delay={0.15}>
        <SecurityCard />
      </Reveal>
    </div>
  );
};
