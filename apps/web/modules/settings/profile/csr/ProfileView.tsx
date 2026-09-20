"use client";

import { Reveal } from "@/components/shared/reveal";
import type { IUser } from "@/lib/types/user";
import { AppearanceCard } from "./AppearanceCard";
import { ProfileInformationCard } from "./ProfileInformationCard";
import { SecurityCard } from "./SecurityCard";

interface ProfileViewProps {
  user: IUser;
}

export const ProfileView = ({ user }: ProfileViewProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your personal profile information and preferences.
        </p>
      </div>

      <Reveal delay={0}>
        <ProfileInformationCard user={user} />
      </Reveal>

      <Reveal delay={0.05}>
        <AppearanceCard />
      </Reveal>

      <Reveal delay={0.1}>
        <SecurityCard />
      </Reveal>
    </div>
  );
};
