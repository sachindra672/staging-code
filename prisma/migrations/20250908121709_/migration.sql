-- CreateTable
CREATE TABLE "PreSessionReminder" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,

    CONSTRAINT "PreSessionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreSessionReminder_sessionId_studentId_type_key" ON "PreSessionReminder"("sessionId", "studentId", "type");

-- AddForeignKey
ALTER TABLE "PreSessionReminder" ADD CONSTRAINT "PreSessionReminder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSessionReminder" ADD CONSTRAINT "PreSessionReminder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
