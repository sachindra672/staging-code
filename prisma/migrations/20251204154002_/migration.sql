-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('ENDUSER', 'MENTOR', 'SALESMAN', 'ADMIN', 'SUBADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('TASK_REWARD', 'MANUAL_REWARD', 'MANUAL_REWARD_BUDGET', 'TRANSFER', 'DEDUCT', 'BONUS', 'PURCHASE', 'PURCHASE_REFUND', 'PURCHASE_ITEM', 'PURCHASE_ITEM_REFUND', 'MINT', 'BURN', 'EXPIRE');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BalanceType" AS ENUM ('SPENDABLE', 'REWARD_BUDGET');

-- CreateEnum
CREATE TYPE "LockType" AS ENUM ('VEST', 'PROMO', 'STAKE');

-- CreateEnum
CREATE TYPE "StoreOrderStatus" AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SisyaWallet" (
    "id" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "spendableBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rewardBudget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lockedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SisyaWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'COMPLETED',
    "amount" DECIMAL(65,30) NOT NULL,
    "fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "balanceBefore" DECIMAL(65,30) NOT NULL,
    "balanceAfter" DECIMAL(65,30) NOT NULL,
    "balanceType" "BalanceType",
    "counterpartyWalletId" TEXT,
    "metadata" JSONB,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiatedByType" "OwnerType",
    "initiatedById" INTEGER,

    CONSTRAINT "SisyaTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaLock" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "remaining" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "lockType" "LockType" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "unlocksAt" TIMESTAMP(3) NOT NULL,
    "isReleased" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "SisyaLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaExpiryBalance" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amountTotal" DECIMAL(65,30) NOT NULL,
    "amountUsed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountExpired" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "expiredAt" TIMESTAMP(3),

    CONSTRAINT "SisyaExpiryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaReward" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "coinsEarned" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "SisyaReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaAuditLog" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" "OwnerType" NOT NULL,
    "actorId" INTEGER NOT NULL,
    "before" DECIMAL(65,30) NOT NULL,
    "delta" DECIMAL(65,30) NOT NULL,
    "after" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SisyaAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaRate" (
    "id" SERIAL NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "coinsPerUnit" DECIMAL(65,30) NOT NULL,
    "offerPercent" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SisyaRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaFiatPurchase" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "amountFiat" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "coinsIssued" DECIMAL(65,30) NOT NULL,
    "paymentProvider" TEXT,
    "providerRef" TEXT,
    "signature" TEXT,
    "status" "TxStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SisyaFiatPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaStoreItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "priceCoins" DECIMAL(65,30) NOT NULL,
    "originalCoins" DECIMAL(65,30),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SisyaStoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaStoreOrder" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "ownerType" "OwnerType" NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "totalCoins" DECIMAL(65,30) NOT NULL,
    "status" "StoreOrderStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "SisyaStoreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaStoreOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceAtPurchase" DECIMAL(65,30) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "SisyaStoreOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaRewardLimit" (
    "id" TEXT NOT NULL,
    "role" "OwnerType" NOT NULL,
    "dailyLimit" DECIMAL(65,30) NOT NULL,
    "monthlyLimit" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SisyaRewardLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaRewardLimitUser" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "dailyLimit" DECIMAL(65,30) NOT NULL,
    "monthlyLimit" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SisyaRewardLimitUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisyaRewardUsage" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amountRewarded" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SisyaRewardUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SisyaWallet_ownerType_ownerId_key" ON "SisyaWallet"("ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "SisyaTransaction_reference_key" ON "SisyaTransaction"("reference");

-- CreateIndex
CREATE INDEX "SisyaTransaction_walletId_idx" ON "SisyaTransaction"("walletId");

-- CreateIndex
CREATE INDEX "SisyaTransaction_type_idx" ON "SisyaTransaction"("type");

-- CreateIndex
CREATE INDEX "SisyaTransaction_createdAt_idx" ON "SisyaTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "SisyaLock_walletId_idx" ON "SisyaLock"("walletId");

-- CreateIndex
CREATE INDEX "SisyaLock_unlocksAt_idx" ON "SisyaLock"("unlocksAt");

-- CreateIndex
CREATE INDEX "SisyaExpiryBalance_walletId_idx" ON "SisyaExpiryBalance"("walletId");

-- CreateIndex
CREATE INDEX "SisyaExpiryBalance_expiresAt_idx" ON "SisyaExpiryBalance"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SisyaReward_walletId_taskCode_key" ON "SisyaReward"("walletId", "taskCode");

-- CreateIndex
CREATE INDEX "SisyaAuditLog_walletId_idx" ON "SisyaAuditLog"("walletId");

-- CreateIndex
CREATE INDEX "SisyaAuditLog_createdAt_idx" ON "SisyaAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SisyaRate_isActive_idx" ON "SisyaRate"("isActive");

-- CreateIndex
CREATE INDEX "SisyaRate_baseCurrency_idx" ON "SisyaRate"("baseCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "SisyaFiatPurchase_providerRef_key" ON "SisyaFiatPurchase"("providerRef");

-- CreateIndex
CREATE INDEX "SisyaFiatPurchase_ownerId_idx" ON "SisyaFiatPurchase"("ownerId");

-- CreateIndex
CREATE INDEX "SisyaFiatPurchase_status_idx" ON "SisyaFiatPurchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SisyaRewardLimit_role_key" ON "SisyaRewardLimit"("role");

-- CreateIndex
CREATE UNIQUE INDEX "SisyaRewardLimitUser_walletId_key" ON "SisyaRewardLimitUser"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "SisyaRewardUsage_walletId_date_key" ON "SisyaRewardUsage"("walletId", "date");

-- AddForeignKey
ALTER TABLE "SisyaTransaction" ADD CONSTRAINT "SisyaTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaLock" ADD CONSTRAINT "SisyaLock_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaExpiryBalance" ADD CONSTRAINT "SisyaExpiryBalance_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaReward" ADD CONSTRAINT "SisyaReward_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaAuditLog" ADD CONSTRAINT "SisyaAuditLog_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaFiatPurchase" ADD CONSTRAINT "SisyaFiatPurchase_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaStoreOrder" ADD CONSTRAINT "SisyaStoreOrder_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaStoreOrderItem" ADD CONSTRAINT "SisyaStoreOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SisyaStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaStoreOrderItem" ADD CONSTRAINT "SisyaStoreOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SisyaStoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaRewardLimitUser" ADD CONSTRAINT "SisyaRewardLimitUser_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisyaRewardUsage" ADD CONSTRAINT "SisyaRewardUsage_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "SisyaWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
