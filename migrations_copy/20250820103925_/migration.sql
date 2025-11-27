-- CreateTable
CREATE TABLE "AIRating" (
    "id" SERIAL NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "AIRating_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AIRating" ADD CONSTRAINT "AIRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
