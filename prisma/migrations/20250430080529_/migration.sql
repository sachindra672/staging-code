-- CreateTable
CREATE TABLE "qtest" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "Duration" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qtest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qtestQuestions" (
    "id" SERIAL NOT NULL,
    "type" "qtype" NOT NULL DEFAULT 'multipleChoice',
    "question" TEXT NOT NULL DEFAULT 'this is some question text',
    "option1" TEXT NOT NULL,
    "option2" TEXT NOT NULL,
    "option3" TEXT,
    "option4" TEXT,
    "correctResponse" INTEGER NOT NULL,
    "ctestId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qtestId" INTEGER NOT NULL,

    CONSTRAINT "qtestQuestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qtestSubmission" (
    "id" SERIAL NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ctestId" INTEGER NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qtestId" INTEGER,

    CONSTRAINT "qtestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qTestResponse" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" INTEGER NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "qtestQuestionsId" INTEGER NOT NULL,
    "qtestId" INTEGER NOT NULL,
    "qtestSubmissionId" INTEGER NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qTestResponse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "qtest" ADD CONSTRAINT "qtest_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qtest" ADD CONSTRAINT "qtest_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qtest" ADD CONSTRAINT "qtest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qtestQuestions" ADD CONSTRAINT "qtestQuestions_qtestId_fkey" FOREIGN KEY ("qtestId") REFERENCES "qtest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qtestSubmission" ADD CONSTRAINT "qtestSubmission_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qtestSubmission" ADD CONSTRAINT "qtestSubmission_qtestId_fkey" FOREIGN KEY ("qtestId") REFERENCES "qtest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qTestResponse" ADD CONSTRAINT "qTestResponse_qtestId_fkey" FOREIGN KEY ("qtestId") REFERENCES "qtest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qTestResponse" ADD CONSTRAINT "qTestResponse_qtestQuestionsId_fkey" FOREIGN KEY ("qtestQuestionsId") REFERENCES "qtestQuestions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qTestResponse" ADD CONSTRAINT "qTestResponse_qtestSubmissionId_fkey" FOREIGN KEY ("qtestSubmissionId") REFERENCES "qtestSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qTestResponse" ADD CONSTRAINT "qTestResponse_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
