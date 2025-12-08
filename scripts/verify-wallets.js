/**
 * verify-wallets.js
 *
 * Usage:
 *   node scripts/verify-wallets.js
 *   node scripts/verify-wallets.js --ownerType=ENDUSER
 *
 * Behavior:
 *  - Verifies that all users have wallets
 *  - Reports missing wallets
 *  - Provides statistics on wallet coverage
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM_WALLET_OWNER_ID = 0;

const args = process.argv.slice(2);
const ownerTypeArg = args.find(arg => arg.startsWith('--ownerType='))?.split('=')[1];

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

const stats = {
  systemWallet: { exists: false },
  endUsers: { total: 0, withWallets: 0, missing: [] },
  mentors: { total: 0, withWallets: 0, missing: [] },
  salesmen: { total: 0, withWallets: 0, missing: [], bigIntIssues: [] },
  admins: { total: 0, withWallets: 0, missing: [] }
};

function fitsInInt(bigIntValue) {
  const maxInt = 2147483647;
  const minInt = -2147483648;
  return bigIntValue >= minInt && bigIntValue <= maxInt;
}

async function verifySystemWallet() {
  log("\n=== Verifying System Wallet ===");
  
  const wallet = await prisma.sisyaWallet.findUnique({
    where: {
      ownerType_ownerId: {
        ownerType: "SYSTEM",
        ownerId: SYSTEM_WALLET_OWNER_ID
      }
    }
  });

  if (wallet) {
    log(`System wallet exists (id: ${wallet.id})`);
    stats.systemWallet.exists = true;
  } else {
    log(`System wallet is MISSING`);
    stats.systemWallet.exists = false;
  }
}

async function verifyEndUserWallets() {
  if (ownerTypeArg && ownerTypeArg !== "ENDUSER") {
    return;
  }

  log("\n=== Verifying EndUser Wallets ===");

  const users = await prisma.endUsers.findMany({
    select: { id: true },
    orderBy: { id: "asc" }
  });

  stats.endUsers.total = users.length;
  log(`Found ${users.length} endUser(s)`);

  for (const user of users) {
    const wallet = await prisma.sisyaWallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: "ENDUSER",
          ownerId: user.id
        }
      }
    });

    if (wallet) {
      stats.endUsers.withWallets++;
    } else {
      stats.endUsers.missing.push(user.id);
    }
  }

  log(`  With wallets: ${stats.endUsers.withWallets}`);
  log(`  Missing: ${stats.endUsers.missing.length}`);
  if (stats.endUsers.missing.length > 0 && stats.endUsers.missing.length <= 10) {
    log(`  Missing IDs: ${stats.endUsers.missing.join(", ")}`);
  } else if (stats.endUsers.missing.length > 10) {
    log(`  Missing IDs (first 10): ${stats.endUsers.missing.slice(0, 10).join(", ")}...`);
  }
}

/**
 * Verify mentor wallets
 */
async function verifyMentorWallets() {
  if (ownerTypeArg && ownerTypeArg !== "MENTOR") {
    return;
  }

  log("\n=== Verifying Mentor Wallets ===");

  const mentors = await prisma.mentor.findMany({
    select: { id: true },
    orderBy: { id: "asc" }
  });

  stats.mentors.total = mentors.length;
  log(`Found ${mentors.length} mentor(s)`);

  for (const mentor of mentors) {
    const wallet = await prisma.sisyaWallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: "MENTOR",
          ownerId: mentor.id
        }
      }
    });

    if (wallet) {
      stats.mentors.withWallets++;
    } else {
      stats.mentors.missing.push(mentor.id);
    }
  }

  log(`  With wallets: ${stats.mentors.withWallets}`);
  log(`  Missing: ${stats.mentors.missing.length}`);
  if (stats.mentors.missing.length > 0 && stats.mentors.missing.length <= 10) {
    log(`  Missing IDs: ${stats.mentors.missing.join(", ")}`);
  } else if (stats.mentors.missing.length > 10) {
    log(`  Missing IDs (first 10): ${stats.mentors.missing.slice(0, 10).join(", ")}...`);
  }
}

/**
 * Verify salesman wallets
 */
async function verifySalesmanWallets() {
  if (ownerTypeArg && ownerTypeArg !== "SALESMAN") {
    return;
  }

  log("\n=== Verifying Salesman Wallets ===");

  const salesmen = await prisma.salesman.findMany({
    select: { id: true },
    orderBy: { id: "asc" }
  });

  stats.salesmen.total = salesmen.length;
  log(`Found ${salesmen.length} salesman/salesmen`);

  for (const salesman of salesmen) {
    // Check if BigInt fits in Int
    if (!fitsInInt(salesman.id)) {
      stats.salesmen.bigIntIssues.push(Number(salesman.id));
      continue;
    }

    const ownerId = Number(salesman.id);
    const wallet = await prisma.sisyaWallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: "SALESMAN",
          ownerId: ownerId
        }
      }
    });

    if (wallet) {
      stats.salesmen.withWallets++;
    } else {
      stats.salesmen.missing.push(ownerId);
    }
  }

  log(`  With wallets: ${stats.salesmen.withWallets}`);
  log(`  Missing: ${stats.salesmen.missing.length}`);
  if (stats.salesmen.missing.length > 0 && stats.salesmen.missing.length <= 10) {
    log(`  Missing IDs: ${stats.salesmen.missing.join(", ")}`);
  } else if (stats.salesmen.missing.length > 10) {
    log(`  Missing IDs (first 10): ${stats.salesmen.missing.slice(0, 10).join(", ")}...`);
  }
  if (stats.salesmen.bigIntIssues.length > 0) {
    log(`  ⚠️  BigInt Issues: ${stats.salesmen.bigIntIssues.length} salesman IDs too large for Int type`);
  }
}

/**
 * Verify admin wallets
 */
async function verifyAdminWallets() {
  if (ownerTypeArg && ownerTypeArg !== "ADMIN" && ownerTypeArg !== "SUBADMIN") {
    return;
  }

  log("\n=== Verifying Admin Wallets ===");

  const admins = await prisma.admin.findMany({
    select: { id: true },
    orderBy: { id: "asc" }
  });

  stats.admins.total = admins.length;
  log(`Found ${admins.length} admin(s)`);

  // Note: We're checking for ADMIN type only
  // If you have a separate SUBADMIN flag/table, adjust this logic
  for (const admin of admins) {
    const wallet = await prisma.sisyaWallet.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: "ADMIN",
          ownerId: admin.id
        }
      }
    });

    if (wallet) {
      stats.admins.withWallets++;
    } else {
      stats.admins.missing.push(admin.id);
    }
  }

  log(`  With wallets: ${stats.admins.withWallets}`);
  log(`  Missing: ${stats.admins.missing.length}`);
  if (stats.admins.missing.length > 0 && stats.admins.missing.length <= 10) {
    log(`  Missing IDs: ${stats.admins.missing.join(", ")}`);
  } else if (stats.admins.missing.length > 10) {
    log(`  Missing IDs (first 10): ${stats.admins.missing.slice(0, 10).join(", ")}...`);
  }
}

/**
 * Print summary
 */
function printSummary() {
  log("\n" + "=".repeat(60));
  log("WALLET VERIFICATION SUMMARY");
  log("=".repeat(60));

  log("\nSystem Wallet:");
  log(`  Status: ${stats.systemWallet.exists ? "✓ EXISTS" : "❌ MISSING"}`);

  log("\nEndUsers:");
  log(`  Total: ${stats.endUsers.total}`);
  log(`  With Wallets: ${stats.endUsers.withWallets} (${stats.endUsers.total > 0 ? Math.round((stats.endUsers.withWallets / stats.endUsers.total) * 100) : 0}%)`);
  log(`  Missing: ${stats.endUsers.missing.length}`);

  log("\nMentors:");
  log(`  Total: ${stats.mentors.total}`);
  log(`  With Wallets: ${stats.mentors.withWallets} (${stats.mentors.total > 0 ? Math.round((stats.mentors.withWallets / stats.mentors.total) * 100) : 0}%)`);
  log(`  Missing: ${stats.mentors.missing.length}`);

  log("\nSalesmen:");
  log(`  Total: ${stats.salesmen.total}`);
  log(`  With Wallets: ${stats.salesmen.withWallets} (${stats.salesmen.total > 0 ? Math.round((stats.salesmen.withWallets / stats.salesmen.total) * 100) : 0}%)`);
  log(`  Missing: ${stats.salesmen.missing.length}`);
  if (stats.salesmen.bigIntIssues.length > 0) {
    log(`  ⚠️  BigInt Issues: ${stats.salesmen.bigIntIssues.length}`);
  }

  log("\nAdmins:");
  log(`  Total: ${stats.admins.total}`);
  log(`  With Wallets: ${stats.admins.withWallets} (${stats.admins.total > 0 ? Math.round((stats.admins.withWallets / stats.admins.total) * 100) : 0}%)`);
  log(`  Missing: ${stats.admins.missing.length}`);

  const totalUsers = 
    stats.endUsers.total +
    stats.mentors.total +
    stats.salesmen.total +
    stats.admins.total;

  const totalWithWallets = 
    stats.endUsers.withWallets +
    stats.mentors.withWallets +
    stats.salesmen.withWallets +
    stats.admins.withWallets;

  const totalMissing = 
    stats.endUsers.missing.length +
    stats.mentors.missing.length +
    stats.salesmen.missing.length +
    stats.admins.missing.length;

  log("\n" + "-".repeat(60));
  log(`Total Users: ${totalUsers}`);
  log(`Total With Wallets: ${totalWithWallets} (${totalUsers > 0 ? Math.round((totalWithWallets / totalUsers) * 100) : 0}%)`);
  log(`Total Missing: ${totalMissing}`);
  log("=".repeat(60));

  if (totalMissing === 0 && stats.systemWallet.exists) {
    log("\n✓ All wallets are present!");
  } else {
    log("\n⚠️  Some wallets are missing. Run create-wallets-migration.js to create them.");
  }
}

/**
 * Main verification function
 */
async function verifyWallets() {
  log("Starting wallet verification...");
  log(`Filter: ownerType=${ownerTypeArg || "ALL"}`);

  try {
    await verifySystemWallet();
    await verifyEndUserWallets();
    await verifyMentorWallets();
    await verifySalesmanWallets();
    await verifyAdminWallets();

    printSummary();
  } catch (error) {
    log(`❌ Verification failed: ${error.message || String(error)}`);
    throw error;
  }
}

// Run verification
verifyWallets()
  .catch(async (err) => {
    log("Unhandled error:", err.message || String(err));
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

