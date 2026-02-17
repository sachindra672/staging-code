/*
  Warnings:

  - You are about to drop the column `playStoreId` on the `BigCourseBundle` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BigCourseBundle" DROP COLUMN "playStoreId",
ADD COLUMN     "appId" INTEGER;
