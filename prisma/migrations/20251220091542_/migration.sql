-- CreateTable
CREATE TABLE "RecordingWatchProgress" (
    "id" SERIAL NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "hasPlayed" BOOLEAN NOT NULL DEFAULT false,
    "firstPlayedAt" TIMESTAMP(3),
    "totalUniqueWatchTime" INTEGER NOT NULL DEFAULT 0,
    "maxProgress" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "rewardGiven" BOOLEAN NOT NULL DEFAULT false,
    "rewardGivenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingWatchProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingWatchSegment" (
    "id" SERIAL NOT NULL,
    "watchProgressId" INTEGER NOT NULL,
    "startTime" INTEGER NOT NULL,
    "endTime" INTEGER NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER NOT NULL,

    CONSTRAINT "RecordingWatchSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecordingWatchProgress_endUsersId_idx" ON "RecordingWatchProgress"("endUsersId");

-- CreateIndex
CREATE INDEX "RecordingWatchProgress_contentType_contentId_idx" ON "RecordingWatchProgress"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "RecordingWatchProgress_isCompleted_idx" ON "RecordingWatchProgress"("isCompleted");

-- CreateIndex
CREATE INDEX "RecordingWatchProgress_rewardGiven_idx" ON "RecordingWatchProgress"("rewardGiven");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingWatchProgress_endUsersId_contentType_contentId_key" ON "RecordingWatchProgress"("endUsersId", "contentType", "contentId");

-- CreateIndex
CREATE INDEX "RecordingWatchSegment_watchProgressId_idx" ON "RecordingWatchSegment"("watchProgressId");

-- CreateIndex
CREATE INDEX "RecordingWatchSegment_watchedAt_idx" ON "RecordingWatchSegment"("watchedAt");

-- AddForeignKey
ALTER TABLE "RecordingWatchProgress" ADD CONSTRAINT "RecordingWatchProgress_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingWatchSegment" ADD CONSTRAINT "RecordingWatchSegment_watchProgressId_fkey" FOREIGN KEY ("watchProgressId") REFERENCES "RecordingWatchProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
