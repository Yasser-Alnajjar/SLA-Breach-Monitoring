-- CreateEnum
CREATE TYPE "EmailSecurity" AS ENUM ('none', 'starttls', 'ssl_tls');

-- CreateTable
CREATE TABLE "organization_email_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "security" "EmailSecurity" NOT NULL DEFAULT 'starttls',
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_email_settings_organizationId_key" ON "organization_email_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "organization_email_settings" ADD CONSTRAINT "organization_email_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
