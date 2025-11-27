-- AlterTable
ALTER TABLE "GroupMessage" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedBy" TEXT,
ADD COLUMN     "senderName" TEXT;
