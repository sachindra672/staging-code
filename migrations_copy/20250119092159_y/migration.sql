/*
  Warnings:

  - You are about to drop the column `class` on the `inq` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "inq" DROP COLUMN "class",
ADD COLUMN     "targetClass" TEXT;
