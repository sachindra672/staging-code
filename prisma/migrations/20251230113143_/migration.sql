-- AlterTable
ALTER TABLE "doubtPackagePurchases" ADD COLUMN     "amountPaid" DECIMAL(10,2),
ADD COLUMN     "doubtPackageId" INTEGER;

-- CreateTable
CREATE TABLE "doubtPackage" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "doubtCount" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discountedPrice" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doubtPackage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "doubtPackagePurchases" ADD CONSTRAINT "doubtPackagePurchases_doubtPackageId_fkey" FOREIGN KEY ("doubtPackageId") REFERENCES "doubtPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
