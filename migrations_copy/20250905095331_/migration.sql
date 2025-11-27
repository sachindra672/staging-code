-- CreateTable
CREATE TABLE "parentQuiz" (
    "id" BIGSERIAL NOT NULL,
    "leadId" BIGINT NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parentQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parentQuizQuestion" (
    "id" BIGSERIAL NOT NULL,
    "quizId" BIGINT NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT[],
    "answer" TEXT NOT NULL,

    CONSTRAINT "parentQuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parentQuiz_leadId_key" ON "parentQuiz"("leadId");

-- AddForeignKey
ALTER TABLE "parentQuiz" ADD CONSTRAINT "parentQuiz_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parentQuizQuestion" ADD CONSTRAINT "parentQuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "parentQuiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
