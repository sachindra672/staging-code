/**
 * create-wallets-migration.js
 *
 * Usage:
 *   node scripts/create-wallets-migration.js
 *   node scripts/create-wallets-migration.js --ownerType=ENDUSER
 *   node scripts/create-wallets-migration.js --ownerType=MENTOR --ownerId=123
 *
 * Behavior:
 *  - Creates system wallet first (if not exists)
 *  - Creates wallets for all existing users (endUsers, mentor, salesman, admin)
 *  - Handles BigInt to Int conversion for salesman (with warnings)
 *  - Skips wallets that already exist (idempotent)
 *  - Provides detailed logging and summary
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

// System wallet ownerId constant
const SYSTEM_WALLET_OWNER_ID = 0;

// Parse command line arguments
const args = process.argv.slice(2);
const ownerTypeArg = args.find(arg => arg.startsWith('--ownerType='))?.split('=')[1];
const ownerIdArg = args.find(arg => arg.startsWith('--ownerId='))?.split('=')[1];

// Optional logfile (appends)
const LOGFILE = process.env.LOGFILE || null;

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  if (LOGFILE) {
    fs.appendFileSync(LOGFILE, line + "\n");
  }
}

// Statistics
const stats = {
  systemWallet: { created: 0, skipped: 0 },
  endUsers: { created: 0, skipped: 0, errors: 0 },
  mentors: { created: 0, skipped: 0, errors: 0 },
  salesmen: { created: 0, skipped: 0, errors: 0, bigIntWarnings: 0 },
  admins: { created: 0, skipped: 0, errors: 0 },
  subadmins: { created: 0, skipped: 0, errors: 0 }
};

/**
 * Check if a BigInt value fits in Int range
 * PostgreSQL Int range: -2147483648 to 2147483647
 */
function fitsInInt(bigIntValue) {
  const maxInt = 2147483647;
  const minInt = -2147483648;
  return bigIntValue >= minInt && bigIntValue <= maxInt;
}

/**
 * Create system wallet
 */
async function createSystemWallet() {
  log("\n=== Creating System Wallet ===");
  
  try {
    // Check if system wallet already exists
    const existing = await prisma.sisyaWallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: "SYSTEM",
          ownerId: SYSTEM_WALLET_OWNER_ID
        }
      }
    });

    if (existing) {
      log(`✓ System wallet already exists (id: ${existing.id})`);
      stats.systemWallet.skipped = 1;
      return existing;
    }

    // Create system wallet
    const systemWallet = await prisma.sisyaWallet.create({
      data: {
        ownerType: "SYSTEM",
        ownerId: SYSTEM_WALLET_OWNER_ID,
        spendableBalance: 0,
        rewardBudget: 0,
        lockedAmount: 0,
        totalEarned: 0,
        totalSpent: 0
      }
    });

    log(`✓ Created system wallet (id: ${systemWallet.id})`);
    stats.systemWallet.created = 1;
    return systemWallet;
  } catch (error) {
    log(`❌ Error creating system wallet: ${error.message || String(error)}`);
    throw error;
  }
}

/**
 * Create wallet for a single user
 */
async function createWalletForUser(ownerType, ownerId, userInfo = {}) {
  try {
    // Check if wallet already exists
    const existing = await prisma.sisyaWallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: ownerType,
          ownerId: ownerId
        }
      }
    });

    if (existing) {
      return { created: false, wallet: existing };
    }

    // Create new wallet
    const wallet = await prisma.sisyaWallet.create({
      data: {
        ownerType: ownerType,
        ownerId: ownerId,
        spendableBalance: 0,
        rewardBudget: 0,
        lockedAmount: 0,
        totalEarned: 0,
        totalSpent: 0
      }
    });

    return { created: true, wallet };
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (error.code === 'P2002') {
      const existing = await prisma.sisyaWallet.findUnique({
        where: {
          ownerType_ownerId: {
            ownerType: ownerType,
            ownerId: ownerId
          }
        }
      });
      return { created: false, wallet: existing };
    }
    throw error;
  }
}

/**
 * Create wallets for all endUsers
 */
async function createEndUserWallets() {
  if (ownerTypeArg && ownerTypeArg !== "ENDUSER") {
    log("\n=== Skipping EndUsers (filtered by ownerType) ===");
    return;
  }

  log("\n=== Creating Wallets for EndUsers ===");

  try {
    const users = await prisma.endUsers.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true
      },
      where: ownerIdArg ? { id: parseInt(ownerIdArg) } : undefined,
      orderBy: { id: "asc" }
    });

    log(`Found ${users.length} endUser(s) to process.`);

    for (const user of users) {
      try {
        const result = await createWalletForUser("ENDUSER", user.id, {
          name: user.name,
          email: user.email
        });

        if (result.created) {
          log(`✓ Created wallet for endUser id=${user.id} (${user.name || user.email || user.phone || "N/A"})`);
          stats.endUsers.created++;
        } else {
          log(`⊘ Wallet already exists for endUser id=${user.id}`);
          stats.endUsers.skipped++;
        }
      } catch (error) {
        log(`❌ Error creating wallet for endUser id=${user.id}: ${error.message || String(error)}`);
        stats.endUsers.errors++;
      }
    }
  } catch (error) {
    log(`❌ Error fetching endUsers: ${error.message || String(error)}`);
    stats.endUsers.errors++;
  }
}

/**
 * Create wallets for all mentors
 */
async function createMentorWallets() {
  if (ownerTypeArg && ownerTypeArg !== "MENTOR") {
    log("\n=== Skipping Mentors (filtered by ownerType) ===");
    return;
  }

  log("\n=== Creating Wallets for Mentors ===");

  try {
    const mentors = await prisma.mentor.findMany({
      select: {
        id: true,
        name: true,
        email: true
      },
      where: ownerIdArg ? { id: parseInt(ownerIdArg) } : undefined,
      orderBy: { id: "asc" }
    });

    log(`Found ${mentors.length} mentor(s) to process.`);

    for (const mentor of mentors) {
      try {
        const result = await createWalletForUser("MENTOR", mentor.id, {
          name: mentor.name,
          email: mentor.email
        });

        if (result.created) {
          log(`✓ Created wallet for mentor id=${mentor.id} (${mentor.name || mentor.email || "N/A"})`);
          stats.mentors.created++;
        } else {
          log(`⊘ Wallet already exists for mentor id=${mentor.id}`);
          stats.mentors.skipped++;
        }
      } catch (error) {
        log(`❌ Error creating wallet for mentor id=${mentor.id}: ${error.message || String(error)}`);
        stats.mentors.errors++;
      }
    }
  } catch (error) {
    log(`❌ Error fetching mentors: ${error.message || String(error)}`);
    stats.mentors.errors++;
  }
}

/**
 * Create wallets for all salesmen
 * Note: salesman.id is BigInt, but SisyaWallet.ownerId is Int
 */
async function createSalesmanWallets() {
  if (ownerTypeArg && ownerTypeArg !== "SALESMAN") {
    log("\n=== Skipping Salesmen (filtered by ownerType) ===");
    return;
  }

  log("\n=== Creating Wallets for Salesmen ===");
  log("⚠️  Note: salesman.id is BigInt, but wallet.ownerId is Int. Large IDs will be skipped.");

  try {
    const salesmen = await prisma.salesman.findMany({
      select: {
        id: true,
        name: true,
        email: true
      },
      where: ownerIdArg ? { id: BigInt(ownerIdArg) } : undefined,
      orderBy: { id: "asc" }
    });

    log(`Found ${salesmen.length} salesman/salesmen to process.`);

    for (const salesman of salesmen) {
      try {
        // Check if BigInt fits in Int range
        if (!fitsInInt(salesman.id)) {
          log(`⚠️  Skipping salesman id=${salesman.id} (${salesman.name || salesman.email || "N/A"}): ID too large for Int type`);
          stats.salesmen.bigIntWarnings++;
          stats.salesmen.errors++;
          continue;
        }

        const ownerId = Number(salesman.id); // Convert BigInt to Number (Int)
        const result = await createWalletForUser("SALESMAN", ownerId, {
          name: salesman.name,
          email: salesman.email
        });

        if (result.created) {
          log(`✓ Created wallet for salesman id=${ownerId} (${salesman.name || salesman.email || "N/A"})`);
          stats.salesmen.created++;
        } else {
          log(`⊘ Wallet already exists for salesman id=${ownerId}`);
          stats.salesmen.skipped++;
        }
      } catch (error) {
        log(`❌ Error creating wallet for salesman id=${salesman.id}: ${error.message || String(error)}`);
        stats.salesmen.errors++;
      }
    }
  } catch (error) {
    log(`❌ Error fetching salesmen: ${error.message || String(error)}`);
    stats.salesmen.errors++;
  }
}

/**
 * Create wallets for all admins
 */
async function createAdminWallets() {
  if (ownerTypeArg && ownerTypeArg !== "ADMIN") {
    log("\n=== Skipping Admins (filtered by ownerType) ===");
    return;
  }

  log("\n=== Creating Wallets for Admins ===");

  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        name: true,
        email: true
      },
      where: ownerIdArg ? { id: parseInt(ownerIdArg) } : undefined,
      orderBy: { id: "asc" }
    });

    log(`Found ${admins.length} admin(s) to process.`);

    for (const admin of admins) {
      try {
        const result = await createWalletForUser("ADMIN", admin.id, {
          name: admin.name,
          email: admin.email
        });

        if (result.created) {
          log(`✓ Created wallet for admin id=${admin.id} (${admin.name || admin.email || "N/A"})`);
          stats.admins.created++;
        } else {
          log(`⊘ Wallet already exists for admin id=${admin.id}`);
          stats.admins.skipped++;
        }
      } catch (error) {
        log(`❌ Error creating wallet for admin id=${admin.id}: ${error.message || String(error)}`);
        stats.admins.errors++;
      }
    }
  } catch (error) {
    log(`❌ Error fetching admins: ${error.message || String(error)}`);
    stats.admins.errors++;
  }
}

/**
 * Print summary statistics
 */
function printSummary() {
  log("\n" + "=".repeat(60));
  log("MIGRATION SUMMARY");
  log("=".repeat(60));

  log("\nSystem Wallet:");
  log(`  Created: ${stats.systemWallet.created}`);
  log(`  Skipped: ${stats.systemWallet.skipped}`);

  log("\nEndUsers:");
  log(`  Created: ${stats.endUsers.created}`);
  log(`  Skipped: ${stats.endUsers.skipped}`);
  log(`  Errors: ${stats.endUsers.errors}`);

  log("\nMentors:");
  log(`  Created: ${stats.mentors.created}`);
  log(`  Skipped: ${stats.mentors.skipped}`);
  log(`  Errors: ${stats.mentors.errors}`);

  log("\nSalesmen:");
  log(`  Created: ${stats.salesmen.created}`);
  log(`  Skipped: ${stats.salesmen.skipped}`);
  log(`  Errors: ${stats.salesmen.errors}`);
  if (stats.salesmen.bigIntWarnings > 0) {
    log(`  ⚠️  BigInt Warnings: ${stats.salesmen.bigIntWarnings} (IDs too large for Int type)`);
  }

  log("\nAdmins:");
  log(`  Created: ${stats.admins.created}`);
  log(`  Skipped: ${stats.admins.skipped}`);
  log(`  Errors: ${stats.admins.errors}`);

  const totalCreated = 
    stats.systemWallet.created +
    stats.endUsers.created +
    stats.mentors.created +
    stats.salesmen.created +
    stats.admins.created;

  const totalSkipped = 
    stats.systemWallet.skipped +
    stats.endUsers.skipped +
    stats.mentors.skipped +
    stats.salesmen.skipped +
    stats.admins.skipped;

  const totalErrors = 
    stats.endUsers.errors +
    stats.mentors.errors +
    stats.salesmen.errors +
    stats.admins.errors;

  log("\n" + "-".repeat(60));
  log(`Total Wallets Created: ${totalCreated}`);
  log(`Total Wallets Skipped: ${totalSkipped}`);
  log(`Total Errors: ${totalErrors}`);
  log("=".repeat(60));
}

/**
 * Main migration function
 */
async function migrateWallets() {
  log("Starting wallet migration...");
  log(`Filters: ownerType=${ownerTypeArg || "ALL"}, ownerId=${ownerIdArg || "ALL"}`);

  try {
    // Step 1: Create system wallet first
    await createSystemWallet();

    // Step 2: Create wallets for all user types
    await createEndUserWallets();
    await createMentorWallets();
    await createSalesmanWallets();
    await createAdminWallets();

    // Step 3: Print summary
    printSummary();

    log("\n✓ Migration completed successfully!");
  } catch (error) {
    log(`\n❌ Migration failed with error: ${error.message || String(error)}`);
    printSummary();
    throw error;
  }
}

// Run migration
migrateWallets()
  .catch(async (err) => {
    log("Unhandled error:", err.message || String(err));
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

