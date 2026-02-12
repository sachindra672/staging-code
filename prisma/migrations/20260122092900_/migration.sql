-- CreateTable
CREATE TABLE "doubtReview" (
    "id" SERIAL NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doubtId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "doubtReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doubtReview_doubtId_userId_key" ON "doubtReview"("doubtId", "userId");

-- AddForeignKey
ALTER TABLE "doubtReview" ADD CONSTRAINT "doubtReview_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "doubt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtReview" ADD CONSTRAINT "doubtReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
