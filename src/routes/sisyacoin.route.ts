import express from "express";
import {
    getMyWallet,
    getWalletByOwner,
    getAllWallets,
} from "../sisyacoin/walletController";
import {
    mintCoins,
    burnCoins,
    createRate,
    getRates,
    updateRate,
    setRoleRewardLimit,
    getRoleRewardLimits,
} from "../sisyacoin/adminCoinController";
import {
    allocateRewardBudget,
    adjustRewardBudget,
    getRewardBudget,
    setUserRewardLimit,
    getUserRewardLimits,
} from "../sisyacoin/rewardBudgetController";
import {
    grantManualReward,
    getRewardsGiven,
    getRewardsReceived,
} from "../sisyacoin/manualRewardController";
import {
    getMyTransactions,
    getTransactionById,
    getWalletTransactions,
} from "../sisyacoin/transactionController";
import {
    getStoreItems,
    createStoreItem,
    updateStoreItem,
    createOrder,
    getMyOrders,
    getOrderById,
    refundOrder,
} from "../sisyacoin/storeController";
import {
    initiateFiatPurchase,
    handlePaymentWebhook,
    getMyFiatPurchases,
    getAllFiatPurchases,
} from "../sisyacoin/fiatPurchaseController";
import {
    authAdmin,
    authAdminOrMentor,
    authAnyone,
    authMentor,
    authUser,
} from "../middlewares/auth";

const router = express.Router();

// Wallets
router.get("/wallet/me", authAnyone, getMyWallet);
router.get("/admin/wallets/:ownerType/:ownerId", authAdmin, getWalletByOwner);
router.get("/admin/wallets", authAdmin, getAllWallets);

// Admin coin ops & rates
router.post("/admin/coins/mint", authAdmin, mintCoins);
router.post("/admin/coins/burn", authAdmin, burnCoins);
router.post("/admin/rates", authAdmin, createRate);
router.get("/admin/rates", authAdmin, getRates);
router.put("/admin/rates/:id", authAdmin, updateRate);

// Reward limits (role-level)
router.put(
    "/admin/reward-limits/role/:ownerType",
    authAdmin,
    setRoleRewardLimit
);
router.get("/admin/reward-limits/roles", authAdmin, getRoleRewardLimits);

// Reward budgets & user-level limits
router.post(
    "/admin/reward-budgets/allocate",
    authAdmin,
    allocateRewardBudget
);
router.post("/admin/reward-budgets/adjust", authAdmin, adjustRewardBudget);
router.get(
    "/admin/reward-budgets/:ownerType/:ownerId",
    authAdmin,
    getRewardBudget
);
router.put(
    "/admin/reward-limits/users/:walletId",
    authAdmin,
    setUserRewardLimit
);
router.get("/admin/reward-limits/users", authAdmin, getUserRewardLimits);

// Manual rewards
router.post("/rewards/manual", authMentor, grantManualReward);
router.get("/rewards/manual/given", authMentor, getRewardsGiven);
router.get("/rewards/manual/received", authUser, getRewardsReceived);

// Transactions
router.get("/transactions/me", authAnyone, getMyTransactions);
router.get("/transactions/:id", authAnyone, getTransactionById);
router.get(
    "/admin/wallets/:walletId/transactions",
    authAdmin,
    getWalletTransactions
);

// Store
router.get("/store/items", authAnyone, getStoreItems);
router.post("/admin/store/items", authAdmin, createStoreItem);
router.put("/admin/store/items/:id", authAdmin, updateStoreItem);
router.post("/store/orders", authUser, createOrder);
router.get("/store/orders/me", authUser, getMyOrders);
router.get("/store/orders/:id", authAnyone, getOrderById);
router.post("/admin/store/orders/:id/refund", authAdmin, refundOrder);

// Fiat purchases
router.post("/fiat-purchases", authUser, initiateFiatPurchase);
router.post(
    "/fiat-purchases/provider/webhook",
    handlePaymentWebhook // no auth; provider-callback endpoint
);
router.get("/fiat-purchases/me", authUser, getMyFiatPurchases);
router.get("/admin/fiat-purchases", authAdmin, getAllFiatPurchases);

export default router;

