-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('ADMIN_ONLY', 'MENTOR', 'ALL');

-- AlterTable
ALTER TABLE "GroupChat" ADD COLUMN     "groupType" "GroupType" NOT NULL DEFAULT 'ALL';
