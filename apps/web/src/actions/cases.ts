import "server-only";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getCaseDetailData } from "@/lib/case-detail-data";
import type { CaseDetailData } from "@/lib/types/cases";

export const CasesActions = {
  async getDetail(caseId: string): Promise<CaseDetailData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    const data = await getCaseDetailData(prisma, session.user.organizationId, caseId);
    if (!data) notFound();
    return data;
  },
};
