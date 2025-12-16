-- CreateTable
CREATE TABLE "SisyaAvatar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "priceCoins" DECIMAL(65,30) NOT NULL,
    "originalCoins" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLimited" BOOLEAN NOT NULL DEFAULT false,
    "totalSupply" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SisyaAvatar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaAvatarPurchase" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "avatarId" TEXT NOT NULL,
    "pricePaid" DECIMAL(65,30) NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "SisyaAvatarPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SisyaAvatarPurchase_avatarId_idx" ON "SisyaAvatarPurchase"("avatarId");

-- CreateIndex
CREATE UNIQUE INDEX "SisyaAvatarPurchase_walletId_avatarId_key" ON "SisyaAvatarPurchase"("walletId", "avatarId");

-- AddForeignKey
ALTER TABLE "SisyaAvatarPurchase" ADD CONSTRAINT "SisyaAvatarPurchase_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaAvatarPurchase" ADD CONSTRAINT "SisyaAvatarPurchase_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "SisyaAvatar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
