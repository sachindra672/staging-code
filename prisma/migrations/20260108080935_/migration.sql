-- AlterTable
ALTER TABLE "doubtSlot" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "doubtSlotInstance" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
