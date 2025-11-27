/*
  Warnings:

  - You are about to drop the `parentQuiz` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `parentQuizQuestion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "parentQuiz" DROP CONSTRAINT "parentQuiz_leadId_fkey";

-- DropForeignKey
ALTER TABLE "parentQuizQuestion" DROP CONSTRAINT "parentQuizQuestion_quizId_fkey";

-- DropTable
DROP TABLE "parentQuiz";

-- DropTable
DROP TABLE "parentQuizQuestion";
