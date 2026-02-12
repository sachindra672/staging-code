/*
  Warnings:

  - A unique constraint covering the columns `[doubtPackageId]` on the table `doubtPackage` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "doubtPackage" ADD COLUMN     "doubtPackageId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "doubtPackage_doubtPackageId_key" ON "doubtPackage"("doubtPackageId");
