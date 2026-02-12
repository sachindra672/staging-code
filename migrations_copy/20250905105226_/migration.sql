-- CreateTable
CREATE TABLE "LeadQuizQuestion" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadQuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadQuizResponse" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadQuizResponse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LeadQuizResponse" ADD CONSTRAINT "LeadQuizResponse_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "RegterationLeads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQuizResponse" ADD CONSTRAINT "LeadQuizResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LeadQuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
