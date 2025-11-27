/*
  Warnings:

  - Added the required column `isTrialRequest` to the `inq` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "inq" ADD COLUMN     "isTrialRequest" BOOLEAN NOT NULL;
