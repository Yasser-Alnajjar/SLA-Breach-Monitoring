import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getWorkerMonitoringData } from "@/lib/worker-settings-data";
import type { WorkerMonitoringData } from "@/lib/types/worker-settings";

export const WorkerSettingsActions = {
  async getData(): Promise<WorkerMonitoringData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    return getWorkerMonitoringData(prisma, session.user.role === "owner");
  },
};
