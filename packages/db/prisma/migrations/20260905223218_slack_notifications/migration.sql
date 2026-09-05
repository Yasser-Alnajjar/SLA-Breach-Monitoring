-- CreateTable
CREATE TABLE "slack_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "channelId" TEXT,
    "channelName" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_integrations_organizationId_key" ON "slack_integrations"("organizationId");

-- AddForeignKey
ALTER TABLE "slack_integrations" ADD CONSTRAINT "slack_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
