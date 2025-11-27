-- CreateTable
CREATE TABLE "OpenSession" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "grade" TEXT,
    "mentorId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "isGoingOn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenSessionBooking" (
    "id" SERIAL NOT NULL,
    "openSessionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "reminderSet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenSessionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenSessionAttendance" (
    "id" SERIAL NOT NULL,
    "openSessionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "OpenSessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenSessionAttendanceInterval" (
    "id" SERIAL NOT NULL,
    "attendanceId" INTEGER NOT NULL,
    "joinTime" TIMESTAMP(3) NOT NULL,
    "leaveTime" TIMESTAMP(3),

    CONSTRAINT "OpenSessionAttendanceInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenSessionQuiz" (
    "id" SERIAL NOT NULL,
    "openSessionId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenSessionQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenSessionQuizResponse" (
    "id" SERIAL NOT NULL,
    "quizId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenSessionQuizResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenSessionFeedback" (
    "id" SERIAL NOT NULL,
    "openSessionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenSessionFeedback_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OpenSession" ADD CONSTRAINT "OpenSession_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionBooking" ADD CONSTRAINT "OpenSessionBooking_openSessionId_fkey" FOREIGN KEY ("openSessionId") REFERENCES "OpenSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionBooking" ADD CONSTRAINT "OpenSessionBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionAttendance" ADD CONSTRAINT "OpenSessionAttendance_openSessionId_fkey" FOREIGN KEY ("openSessionId") REFERENCES "OpenSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionAttendance" ADD CONSTRAINT "OpenSessionAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionAttendanceInterval" ADD CONSTRAINT "OpenSessionAttendanceInterval_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "OpenSessionAttendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionQuiz" ADD CONSTRAINT "OpenSessionQuiz_openSessionId_fkey" FOREIGN KEY ("openSessionId") REFERENCES "OpenSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionQuizResponse" ADD CONSTRAINT "OpenSessionQuizResponse_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "OpenSessionQuiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionQuizResponse" ADD CONSTRAINT "OpenSessionQuizResponse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionFeedback" ADD CONSTRAINT "OpenSessionFeedback_openSessionId_fkey" FOREIGN KEY ("openSessionId") REFERENCES "OpenSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenSessionFeedback" ADD CONSTRAINT "OpenSessionFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
