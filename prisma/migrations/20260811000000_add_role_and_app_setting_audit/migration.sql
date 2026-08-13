-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'SUPERADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "app_setting_audits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_setting_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_setting_audits_key_idx" ON "app_setting_audits"("key");

-- CreateIndex
CREATE INDEX "app_setting_audits_createdAt_idx" ON "app_setting_audits"("createdAt");
