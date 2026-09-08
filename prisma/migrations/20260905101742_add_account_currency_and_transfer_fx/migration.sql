-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'IDR';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "convertedAmount" DECIMAL(15,2),
ADD COLUMN     "exchangeRate" DECIMAL(18,6);
