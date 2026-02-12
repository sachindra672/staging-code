-- AlterTable
ALTER TABLE "mentor" ADD COLUMN     "isAvailableForDoubts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDoubtSpecialist" BOOLEAN NOT NULL DEFAULT false;
