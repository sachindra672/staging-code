import cron from "node-cron"
import { publishScheduledBlogs } from "../blogs";

export const startBlogCron = () => {
    cron.schedule("* * * * *", async () => {
        await publishScheduledBlogs();
    });

    console.log("Blog publish cron started (every minute)");
};