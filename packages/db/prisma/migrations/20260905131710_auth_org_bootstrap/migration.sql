-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('zendesk', 'jira');

-- CreateEnum
CREATE TYPE "CaseLinkMethod" AS ENUM ('official_link', 'remote_link', 'pattern', 'manual');

-- CreateEnum
CREATE TYPE "LinkConfidence" AS ENUM ('certain', 'probable');

-- CreateEnum
CREATE TYPE "LegKind" AS ENUM ('support', 'engineering', 'waiting_customer', 'unknown');

-- CreateEnum
CREATE TYPE "LegConfidence" AS ENUM ('certain', 'inferred', 'unknown');

-- CreateEnum
CREATE TYPE "CommitmentKind" AS ENUM ('first_response', 'resolution');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('on_track', 'at_risk', 'met', 'breached', 'cancelled');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "credentials" JSONB,
    "cursor" JSONB,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_events" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "normalized_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sourceRawEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actor" TEXT NOT NULL,
    "system" "IntegrationProvider" NOT NULL,
    "fromState" TEXT,
    "toState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "normalized_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zendeskOrgId" TEXT,
    "tier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "externalId" TEXT NOT NULL,
    "priority" TEXT,
    "tier" TEXT,
    "channel" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_links" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "system" "IntegrationProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "method" "CaseLinkMethod" NOT NULL,
    "confidence" "LinkConfidence" NOT NULL,
    "evidence" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policy_versions" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "match" JSONB NOT NULL,
    "targets" JSONB NOT NULL,
    "pauseOnStates" TEXT[],
    "calendarVersionId" TEXT NOT NULL,
    "warnAtPercent" INTEGER[],
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendars" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_versions" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "weekly" JSONB NOT NULL,
    "holidays" TEXT[],
    "alwaysOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_calendar_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "CommitmentKind" NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "calendarVersionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "targetMinutes" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "CommitmentStatus" NOT NULL DEFAULT 'on_track',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leg_spans" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "leg" "LegKind" NOT NULL,
    "confidence" "LegConfidence" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leg_spans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "elapsedWorkingMinutes" INTEGER NOT NULL,
    "remainingMinutes" INTEGER NOT NULL,
    "status" "CommitmentStatus" NOT NULL,
    "breachedByMinutes" INTEGER,
    "inputs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_organizationId_provider_key" ON "integrations"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "raw_events_integrationId_fetchedAt_idx" ON "raw_events"("integrationId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "raw_events_integrationId_providerEventId_key" ON "raw_events"("integrationId", "providerEventId");

-- CreateIndex
CREATE INDEX "normalized_events_caseId_occurredAt_idx" ON "normalized_events"("caseId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organizationId_zendeskOrgId_key" ON "customers"("organizationId", "zendeskOrgId");

-- CreateIndex
CREATE INDEX "cases_organizationId_openedAt_idx" ON "cases"("organizationId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cases_organizationId_externalId_key" ON "cases"("organizationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "case_links_caseId_system_externalId_key" ON "case_links"("caseId", "system", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policy_versions_policyId_version_key" ON "sla_policy_versions"("policyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "business_calendar_versions_calendarId_version_key" ON "business_calendar_versions"("calendarId", "version");

-- CreateIndex
CREATE INDEX "commitments_caseId_idx" ON "commitments"("caseId");

-- CreateIndex
CREATE INDEX "commitments_status_idx" ON "commitments"("status");

-- CreateIndex
CREATE INDEX "leg_spans_caseId_startedAt_idx" ON "leg_spans"("caseId", "startedAt");

-- CreateIndex
CREATE INDEX "evaluations_commitmentId_evaluatedAt_idx" ON "evaluations"("commitmentId", "evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_commitmentId_threshold_key" ON "notifications"("commitmentId", "threshold");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_events" ADD CONSTRAINT "normalized_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "normalized_events" ADD CONSTRAINT "normalized_events_sourceRawEventId_fkey" FOREIGN KEY ("sourceRawEventId") REFERENCES "raw_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_links" ADD CONSTRAINT "case_links_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policy_versions" ADD CONSTRAINT "sla_policy_versions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policy_versions" ADD CONSTRAINT "sla_policy_versions_calendarVersionId_fkey" FOREIGN KEY ("calendarVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_calendars" ADD CONSTRAINT "business_calendars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_calendar_versions" ADD CONSTRAINT "business_calendar_versions_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "business_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "sla_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_calendarVersionId_fkey" FOREIGN KEY ("calendarVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leg_spans" ADD CONSTRAINT "leg_spans_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
