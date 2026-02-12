/*
  Warnings:

  - A unique constraint covering the columns `[announcementId,mentorId]` on the table `AnnouncementRead` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "mentorId" INTEGER;

-- AlterTable
ALTER TABLE "AnnouncementRead" ADD COLUMN     "mentorId" INTEGER,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AnnouncementRead_mentorId_idx" ON "AnnouncementRead"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_mentorId_key" ON "AnnouncementRead"("announcementId", "mentorId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
