/*
  Warnings:

  - You are about to drop the column `vmIp` on the `session` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "session" DROP COLUMN "vmIp";

-- AlterTable
ALTER TABLE "sessionStreamInfo" ADD COLUMN     "vmIp" TEXT;
