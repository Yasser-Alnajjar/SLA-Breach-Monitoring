import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { getPrismaClient } from "@sla/db";

import { authOptions } from "@/lib/auth";
import { getAtRiskData } from "@/lib/at-risk-data";
import type { AtRiskRowData } from "@/lib/types/at-risk";

export const AtRiskActions = {
  async getData(): Promise<AtRiskRowData[]> {
    const session = await getServerSession(authOptions);

    if (!session) {
      redirect("/sign-in");
    }

    const prisma = getPrismaClient();

    return getAtRiskData(prisma, session.user.organizationId);
  },
};
