import cron from "node-cron"
import { prisma } from "../misc"
import { AnnouncementController } from "../announcement"

cron.schedule("* * * * *", async () => {
    try {
        const now = new Date();
        const pendingAnnouncements = await prisma.announcement.findMany({
            where: {
                status: "SCHEDULED",
                scheduledAt: { lte: now },
                isDeleted: false
            }
        });

        if (pendingAnnouncements.length === 0) return;

        console.log(`Processing ${pendingAnnouncements.length} scheduled announcements...`);

        for (const announcement of pendingAnnouncements) {
            try {
                await AnnouncementController.sendAnnouncementNotifications(announcement);
                console.log(`Successfully sent scheduled announcement: ${announcement.id}`);
            } catch (error) {
                console.error(`Failed to send scheduled announcement ${announcement.id}:`, error);
            }
        }
    } catch (error) {
        console.error("Error in announcementCron:", error);
    }
});
