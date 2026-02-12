/**
 * migrate-monthly-doubt-benefit.ts
 * 
 * Data migration script for Monthly Doubt Benefit feature
 * 
 * Usage:
 *   npx ts-node scripts/migrate-monthly-doubt-benefit.ts
 *   npx ts-node scripts/migrate-monthly-doubt-benefit.ts --dry-run
 * 
 * Behavior:
 *  - Finds all active mgSubsciption records
 *  - For each enrolled student, finds or creates doubtRecord
 *  - Links doubtRecord to subscription
 *  - Sets enrollment date and monthly benefit fields
 *  - Sets monthlyDoubtsRemaining = 15 (initial monthly benefit, separate from purchased)
 *  - Preserves existing doubtsRemaining (assumes they are purchased doubts)
 *  - Handles multiple subscriptions per user (links to most recent)
 *  - Provides detailed logging and summary
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

// Optional logfile (appends)
const LOGFILE = process.env.LOGFILE || null;

function log(...args: any[]) {
    const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
    console.log(line);
    if (LOGFILE) {
        fs.appendFileSync(LOGFILE, line + "\n");
    }
}

// Statistics
const stats = {
    subscriptionsProcessed: 0,
    doubtRecordsCreated: 0,
    doubtRecordsUpdated: 0,
    doubtRecordsSkipped: 0,
    errors: 0,
    usersWithMultipleSubscriptions: 0,
};

/**
 * Find or create doubtRecord for a user
 */
async function findOrCreateDoubtRecord(userId: number) {
    let doubtRecord = await prisma.doubtRecord.findFirst({
        where: { endUsersId: userId },
    });

    if (!doubtRecord) {
        doubtRecord = await prisma.doubtRecord.create({
            data: {
                endUsersId: userId,
                doubtsAsked: 0,
                doubtsRemaining: 5, // Default purchased doubts
                monthlyDoubtAllowance: 15,
                monthlyDoubtsRemaining: 0, // Will be set to 15 when linked
                isMonthlyBenefitActive: false, // Will be set to true when linked
            },
        });
        stats.doubtRecordsCreated++;
        log(`Created new doubtRecord for user ${userId}`);
    }

    return doubtRecord;
}

/**
 * Get the most recent active subscription for a user
 */
async function getMostRecentSubscription(userId: number) {
    const subscriptions = await prisma.mgSubsciption.findMany({
        where: {
            endUsersId: userId,
            isActive: true,
        },
        orderBy: {
            createdAt: "desc", // Most recent first
        },
    });

    return subscriptions.length > 0 ? subscriptions[0] : null;
}

/**
 * Link doubtRecord to subscription and set monthly benefit
 */
async function linkDoubtRecordToSubscription(
    doubtRecordId: number,
    subscriptionId: number,
    enrollmentDate: Date
) {
    if (isDryRun) {
        log(
            `[DRY RUN] Would link doubtRecord ${doubtRecordId} to subscription ${subscriptionId}`
        );
        return;
    }

    // Get current doubtRecord to preserve existing purchased doubts
    const currentRecord = await prisma.doubtRecord.findUnique({
        where: { id: doubtRecordId },
        select: { doubtsRemaining: true },
    });

    const existingPurchasedDoubts = currentRecord?.doubtsRemaining ?? 5;

    await prisma.doubtRecord.update({
        where: { id: doubtRecordId },
        data: {
            linkedSubscriptionId: subscriptionId,
            enrollmentDate: enrollmentDate,
            lastMonthlyResetDate: enrollmentDate, // First reset will be 30 days from this
            isMonthlyBenefitActive: true,
            doubtsRemaining: existingPurchasedDoubts, // Preserve existing purchased doubts
            monthlyDoubtsRemaining: 15, // Set monthly benefit to 15 (separate from purchased)
            monthlyDoubtAllowance: 15,
        },
    });

    stats.doubtRecordsUpdated++;
    log(
        `Linked doubtRecord ${doubtRecordId} to subscription ${subscriptionId}, ` +
        `preserved purchased doubts: ${existingPurchasedDoubts}, set monthlyDoubtsRemaining = 15`
    );
}

/**
 * Main migration function
 */
async function migrateMonthlyDoubtBenefit() {
    log("=".repeat(80));
    log("Monthly Doubt Benefit Migration Script");
    log("=".repeat(80));
    log(`Mode: ${isDryRun ? "DRY RUN (no changes will be made)" : "LIVE (changes will be committed)"}`);
    log("");

    try {
        // Step 1: Find all active subscriptions
        log("Step 1: Finding all active subscriptions...");
        const activeSubscriptions = await prisma.mgSubsciption.findMany({
            where: {
                isActive: true,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc", // Process most recent first
            },
        });

        log(`Found ${activeSubscriptions.length} active subscriptions`);
        log("");

        // Step 2: Group subscriptions by user to handle multiple subscriptions
        log("Step 2: Grouping subscriptions by user...");
        const subscriptionsByUser = new Map<number, typeof activeSubscriptions>();

        for (const subscription of activeSubscriptions) {
            const userId = subscription.endUsersId;
            if (!subscriptionsByUser.has(userId)) {
                subscriptionsByUser.set(userId, []);
            }
            subscriptionsByUser.get(userId)!.push(subscription);
        }

        log(`Found ${subscriptionsByUser.size} unique users with active subscriptions`);

        // Count users with multiple subscriptions
        for (const [userId, subs] of subscriptionsByUser.entries()) {
            if (subs.length > 1) {
                stats.usersWithMultipleSubscriptions++;
                log(
                    `User ${userId} has ${subs.length} active subscriptions - will link to most recent`
                );
            }
        }
        log("");

        // Step 3: Process each user
        log("Step 3: Processing users and linking doubtRecords...");
        log("");

        for (const [userId, userSubscriptions] of subscriptionsByUser.entries()) {
            try {
                // Get the most recent subscription for this user
                const primarySubscription = userSubscriptions[0]; // Already sorted by createdAt desc

                // Find or create doubtRecord
                const doubtRecord = await findOrCreateDoubtRecord(userId);

                // Check if already linked to a subscription
                if (doubtRecord.linkedSubscriptionId !== null) {
                    // Check if linked subscription is still active
                    const linkedSubscription = await prisma.mgSubsciption.findUnique({
                        where: { id: doubtRecord.linkedSubscriptionId },
                    });

                    if (linkedSubscription && linkedSubscription.isActive) {
                        // Already linked to an active subscription
                        // Check if we should update to more recent subscription
                        if (
                            linkedSubscription.createdAt < primarySubscription.createdAt
                        ) {
                            log(
                                `User ${userId}: Updating link from subscription ${doubtRecord.linkedSubscriptionId} to ${primarySubscription.id} (more recent)`
                            );
                            await linkDoubtRecordToSubscription(
                                doubtRecord.id,
                                primarySubscription.id,
                                primarySubscription.createdAt
                            );
                        } else {
                            stats.doubtRecordsSkipped++;
                            log(
                                `User ${userId}: Already linked to active subscription ${doubtRecord.linkedSubscriptionId}, skipping`
                            );
                        }
                    } else {
                        // Linked subscription is inactive, update to active one
                        log(
                            `User ${userId}: Linked subscription ${doubtRecord.linkedSubscriptionId} is inactive, updating to ${primarySubscription.id}`
                        );
                        await linkDoubtRecordToSubscription(
                            doubtRecord.id,
                            primarySubscription.id,
                            primarySubscription.createdAt
                        );
                    }
                } else {
                    // Not linked, create new link
                    log(
                        `User ${userId}: Linking doubtRecord to subscription ${primarySubscription.id}`
                    );
                    await linkDoubtRecordToSubscription(
                        doubtRecord.id,
                        primarySubscription.id,
                        primarySubscription.createdAt
                    );
                }

                stats.subscriptionsProcessed++;
            } catch (error: any) {
                stats.errors++;
                log(
                    `ERROR processing user ${userId}: ${error.message || error}`
                );
                if (error.stack) {
                    log(`Stack trace: ${error.stack}`);
                }
            }
        }

        // Step 4: Validation
        log("");
        log("Step 4: Validating migration...");

        if (!isDryRun) {
            const linkedCount = await prisma.doubtRecord.count({
                where: {
                    isMonthlyBenefitActive: true,
                    linkedSubscriptionId: { not: null },
                },
            });

            const activeSubscriptionCount = await prisma.mgSubsciption.count({
                where: { isActive: true },
            });

            // Check monthlyDoubtsRemaining field
            const recordsWithMonthlyBenefit = await prisma.doubtRecord.count({
                where: {
                    isMonthlyBenefitActive: true,
                    monthlyDoubtsRemaining: { gte: 15 },
                },
            });

            log(`Active subscriptions: ${activeSubscriptionCount}`);
            log(`Linked doubtRecords with active benefit: ${linkedCount}`);
            log(`DoubtRecords with monthlyDoubtsRemaining >= 15: ${recordsWithMonthlyBenefit}`);

            if (linkedCount < activeSubscriptionCount) {
                log(
                    `WARNING: Some active subscriptions may not be linked. Expected at least ${activeSubscriptionCount}, found ${linkedCount}`
                );
            }
        }

        // Summary
        log("");
        log("=".repeat(80));
        log("Migration Summary");
        log("=".repeat(80));
        log(`Subscriptions processed: ${stats.subscriptionsProcessed}`);
        log(`DoubtRecords created: ${stats.doubtRecordsCreated}`);
        log(`DoubtRecords updated: ${stats.doubtRecordsUpdated}`);
        log(`DoubtRecords skipped: ${stats.doubtRecordsSkipped}`);
        log(`Users with multiple subscriptions: ${stats.usersWithMultipleSubscriptions}`);
        log(`Errors: ${stats.errors}`);
        log("");

        if (isDryRun) {
            log("DRY RUN completed - no changes were made");
            log("Run without --dry-run to apply changes");
        } else {
            log("Migration completed successfully!");
        }
    } catch (error: any) {
        log("");
        log("=".repeat(80));
        log("FATAL ERROR");
        log("=".repeat(80));
        log(`Error: ${error.message || error}`);
        if (error.stack) {
            log(`Stack trace: ${error.stack}`);
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration
migrateMonthlyDoubtBenefit()
    .then(() => {
        log("Script completed");
        process.exit(0);
    })
    .catch((error) => {
        log(`Fatal error: ${error.message || error}`);
        if (error.stack) {
            log(`Stack trace: ${error.stack}`);
        }
        process.exit(1);
    });

