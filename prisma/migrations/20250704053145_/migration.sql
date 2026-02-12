-- CreateTable
CREATE TABLE "SessionAnalytics" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER,
    "classStartTime" TIMESTAMP(3) NOT NULL,
    "classEndTime" TIMESTAMP(3) NOT NULL,
    "actualDuration" INTEGER NOT NULL,
    "scheduledDuration" INTEGER NOT NULL,
    "earlyLeaveRate" DOUBLE PRECISION,
    "lateJoinRate" DOUBLE PRECISION,
    "finishRate" DOUBLE PRECISION,
    "attendancePercentage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAttendanceInterval" (
    "id" SERIAL NOT NULL,
    "analyticsId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "joinTime" TIMESTAMP(3) NOT NULL,
    "leaveTime" TIMESTAMP(3),
    "duration" INTEGER,
    "isEarlyLeave" BOOLEAN,
    "isLateJoin" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAttendanceInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSessionAnalytics" (
    "id" SERIAL NOT NULL,
    "analyticsId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "totalDuration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSessionAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionAnalytics_sessionId_key" ON "SessionAnalytics"("sessionId");

-- CreateIndex
CREATE INDEX "StudentAttendanceInterval_analyticsId_studentId_idx" ON "StudentAttendanceInterval"("analyticsId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSessionAnalytics_analyticsId_key" ON "TeacherSessionAnalytics"("analyticsId");

-- AddForeignKey
ALTER TABLE "SessionAnalytics" ADD CONSTRAINT "SessionAnalytics_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendanceInterval" ADD CONSTRAINT "StudentAttendanceInterval_analyticsId_fkey" FOREIGN KEY ("analyticsId") REFERENCES "SessionAnalytics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendanceInterval" ADD CONSTRAINT "StudentAttendanceInterval_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSessionAnalytics" ADD CONSTRAINT "TeacherSessionAnalytics_analyticsId_fkey" FOREIGN KEY ("analyticsId") REFERENCES "SessionAnalytics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSessionAnalytics" ADD CONSTRAINT "TeacherSessionAnalytics_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
