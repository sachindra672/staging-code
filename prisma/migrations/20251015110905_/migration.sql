/*
  Warnings:

  - Added the required column `class` to the `classCardWeb` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "classCardWeb" ADD COLUMN     "class" INTEGER NOT NULL;
