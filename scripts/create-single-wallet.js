/**
 * create-single-wallet.js
 *
 * Usage:
 *   node scripts/create-single-wallet.js --ownerType=ENDUSER --ownerId=123
 *   node scripts/create-single-wallet.js --ownerType=MENTOR --ownerId=456
 *   node scripts/create-single-wallet.js --ownerType=SYSTEM
 *
 * Behavior:
 *  - Creates a single wallet for a specific owner
 *  - Validates that the owner exists in the database
 *  - Returns wallet details or error message
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// System wallet ownerId constant
const SYSTEM_WALLET_OWNER_ID = 0;

// Parse command line arguments
const args = process.argv.slice(2);
const ownerTypeArg = args.find(arg => arg.startsWith('--ownerType='))?.split('=')[1];
const ownerIdArg = args.find(arg => arg.startsWith('--ownerId='))?.split('=')[1];

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function error(...args) {
  console.error(`[${new Date().toISOString()}] ERROR:`, ...args);
}

/**
 * Validate owner exists in database
 */
async function validateOwner(ownerType, ownerId) {
  switch (ownerType) {
    case "ENDUSER":
      const endUser = await prisma.endUsers.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true, email: true }
      });
      if (!endUser) {
        throw new Error(`EndUser with id=${ownerId} not found`);
      }
      return { exists: true, info: endUser };

    case "MENTOR":
      const mentor = await prisma.mentor.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true, email: true }
      });
      if (!mentor) {
        throw new Error(`Mentor with id=${ownerId} not found`);
      }
      return { exists: true, info: mentor };

    case "SALESMAN":
      const salesman = await prisma.salesman.findUnique({
        where: { id: BigInt(ownerId) },
        select: { id: true, name: true, email: true }
      });
      if (!salesman) {
        throw new Error(`Salesman with id=${ownerId} not found`);
      }
      // Check if BigInt fits in Int
      if (Number(salesman.id) > 2147483647 || Number(salesman.id) < -2147483648) {
        throw new Error(`Salesman id=${salesman.id} is too large for Int type (max: 2147483647)`);
      }
      return { exists: true, info: salesman };

    case "ADMIN":
    case "SUBADMIN":
      const admin = await prisma.admin.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true, email: true }
      });
      if (!admin) {
        throw new Error(`${ownerType} with id=${ownerId} not found`);
      }
      return { exists: true, info: admin };

    case "SYSTEM":
      return { exists: true, info: { id: SYSTEM_WALLET_OWNER_ID, name: "System Wallet" } };

    default:
      throw new Error(`Invalid ownerType: ${ownerType}. Must be one of: ENDUSER, MENTOR, SALESMAN, ADMIN, SUBADMIN, SYSTEM`);
  }
}

/**
 * Create wallet for a single owner
 */
async function createSingleWallet() {
  if (!ownerTypeArg) {
    error("--ownerType is required");
    console.log("\nUsage: node scripts/create-single-wallet.js --ownerType=ENDUSER --ownerId=123");
    process.exit(1);
  }

  // For SYSTEM wallet, ownerId is not required
  let ownerId = SYSTEM_WALLET_OWNER_ID;
  if (ownerTypeArg !== "SYSTEM") {
    if (!ownerIdArg) {
      error("--ownerId is required (except for SYSTEM wallet)");
      console.log("\nUsage: node scripts/create-single-wallet.js --ownerType=ENDUSER --ownerId=123");
      process.exit(1);
    }
    ownerId = parseInt(ownerIdArg);
    if (isNaN(ownerId)) {
      error(`Invalid ownerId: ${ownerIdArg}. Must be a number.`);
      process.exit(1);
    }
  }

  log(`Creating wallet for ownerType=${ownerTypeArg}, ownerId=${ownerId}`);

  try {
    // Validate owner exists
    const validation = await validateOwner(ownerTypeArg, ownerId);
    log(`✓ Owner validated: ${validation.info.name || validation.info.email || `id=${validation.info.id}`}`);

    // Convert salesman BigInt to Int if needed
    let walletOwnerId = ownerId;
    if (ownerTypeArg === "SALESMAN") {
      walletOwnerId = Number(validation.info.id);
    }

    // Check if wallet already exists
    const existing = await prisma.sisyaWallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: ownerTypeArg,
          ownerId: walletOwnerId
        }
      }
    });

    if (existing) {
      log(`⊘ Wallet already exists:`);
      console.log(JSON.stringify(existing, null, 2));
      await prisma.$disconnect();
      process.exit(0);
    }

    // Create wallet
    const wallet = await prisma.sisyaWallet.create({
      data: {
        ownerType: ownerTypeArg,
        ownerId: walletOwnerId,
        spendableBalance: 0,
        rewardBudget: 0,
        lockedAmount: 0,
        totalEarned: 0,
        totalSpent: 0
      }
    });

    log(`✓ Wallet created successfully:`);
    console.log(JSON.stringify(wallet, null, 2));

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    error(error.message || String(error));
    await prisma.$disconnect();
    process.exit(1);
  }
}

createSingleWallet();

