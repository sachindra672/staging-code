-- CreateTable
CREATE TABLE "sisya_class_quiz" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "quizId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "question" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "options" JSONB,
    "timerDuration" INTEGER NOT NULL,
    "timerEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sisya_class_quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sisya_class_quiz_response" (
    "id" SERIAL NOT NULL,
    "quizId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "selectedAnswer" TEXT NOT NULL,
    "timeTaken" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sisya_class_quiz_response_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sisya_class_quiz_sessionId_idx" ON "sisya_class_quiz"("sessionId");

-- CreateIndex
CREATE INDEX "sisya_class_quiz_quizId_idx" ON "sisya_class_quiz"("quizId");

-- CreateIndex
CREATE INDEX "sisya_class_quiz_response_quizId_idx" ON "sisya_class_quiz_response"("quizId");

-- CreateIndex
CREATE INDEX "sisya_class_quiz_response_userId_idx" ON "sisya_class_quiz_response"("userId");

-- CreateIndex
CREATE INDEX "sisya_class_quiz_response_quizId_userId_idx" ON "sisya_class_quiz_response"("quizId", "userId");

-- AddForeignKey
ALTER TABLE "sisya_class_quiz" ADD CONSTRAINT "sisya_class_quiz_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sisya_class_quiz_response" ADD CONSTRAINT "sisya_class_quiz_response_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "sisya_class_quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sisya_class_quiz_response" ADD CONSTRAINT "sisya_class_quiz_response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
