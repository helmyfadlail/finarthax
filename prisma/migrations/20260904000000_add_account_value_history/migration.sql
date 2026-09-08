-- CreateTable
CREATE TABLE "account_value_histories" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "previousBalance" DECIMAL(15,2) NOT NULL,
    "newBalance" DECIMAL(15,2) NOT NULL,
    "changeAmount" DECIMAL(15,2) NOT NULL,
    "changePercent" DECIMAL(9,4) NOT NULL,
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_value_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_value_histories_accountId_idx" ON "account_value_histories"("accountId");

-- CreateIndex
CREATE INDEX "account_value_histories_accountId_recordedAt_idx" ON "account_value_histories"("accountId", "recordedAt");

-- AddForeignKey
ALTER TABLE "account_value_histories" ADD CONSTRAINT "account_value_histories_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
