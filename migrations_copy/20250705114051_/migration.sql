-- CreateTable
CREATE TABLE "SessionFeedback" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "techIssue" TEXT,
    "sessionIssue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionFeedback_sessionId_idx" ON "SessionFeedback"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionFeedback_sessionId_studentId_key" ON "SessionFeedback"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "SessionFeedback" ADD CONSTRAINT "SessionFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionFeedback" ADD CONSTRAINT "SessionFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
