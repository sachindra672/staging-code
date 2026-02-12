/*
  Warnings:

  - A unique constraint covering the columns `[linkedSubscriptionId]` on the table `doubtRecord` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "doubtRecord" ADD COLUMN     "enrollmentDate" TIMESTAMP(3),
ADD COLUMN     "isMonthlyBenefitActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastMonthlyResetDate" TIMESTAMP(3),
ADD COLUMN     "linkedSubscriptionId" INTEGER,
ADD COLUMN     "monthlyDoubtAllowance" INTEGER NOT NULL DEFAULT 15;

-- CreateIndex
CREATE UNIQUE INDEX "doubtRecord_linkedSubscriptionId_key" ON "doubtRecord"("linkedSubscriptionId");

-- AddForeignKey
ALTER TABLE "doubtRecord" ADD CONSTRAINT "doubtRecord_linkedSubscriptionId_fkey" FOREIGN KEY ("linkedSubscriptionId") REFERENCES "mgSubsciption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
