-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "actionData" JSONB,
ADD COLUMN     "actionTarget" TEXT,
ADD COLUMN     "actionType" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;
