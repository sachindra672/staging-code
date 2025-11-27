/*
  Warnings:

  - You are about to drop the column `recordingUrl` on the `session` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "session" DROP COLUMN "recordingUrl",
ADD COLUMN     "hostRecordingUrl" TEXT,
ADD COLUMN     "screenRecordingUrl" TEXT;
