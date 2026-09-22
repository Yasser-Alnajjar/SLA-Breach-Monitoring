-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'revoked');

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_tokenHash_key" ON "organization_invitations"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_acceptedByUserId_key" ON "organization_invitations"("acceptedByUserId");

-- CreateIndex
CREATE INDEX "organization_invitations_organizationId_status_idx" ON "organization_invitations"("organizationId", "status");

-- CreateIndex
-- Guardrail: at most one *pending* invitation per (organizationId, email).
-- Not expressible in Prisma's schema DSL (@@unique has no WHERE clause), so
-- this partial index is hand-added here. Application logic
-- (createOrResendInvitation in @sla/db) already finds-and-updates an
-- existing pending row instead of inserting a second one for the same
-- email; this index is the DB-enforced backstop if two concurrent invite
-- calls for the same email race past that check-then-act.
CREATE UNIQUE INDEX "organization_invitations_org_email_pending_key" ON "organization_invitations"("organizationId", "email") WHERE "status" = 'pending';

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SetNull, not Restrict/Cascade: removing a member (Phase 5 task 5.3) who
-- previously sent invitations must never be blocked, and the invitation row
-- itself survives as history with its inviter reference cleared.
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
