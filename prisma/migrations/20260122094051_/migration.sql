/*
  Warnings:

  - Added the required column `mentorId` to the `doubtReview` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "doubtReview" ADD COLUMN     "mentorId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "doubtReview" ADD CONSTRAINT "doubtReview_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
