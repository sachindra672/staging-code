import cron from "node-cron"
import { prisma } from "../misc"

const BATCH_SIZE = 500 

function chunkArray<T>(arr: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size))
    }
    return result
}

cron.schedule("* * * * *", async () => {
    const dueJobs = await prisma.scheduledNotification.findMany({
        where: {
            sendAt: { lte: new Date() },
            status: "pending"
    }
    });

    for (const job of dueJobs) {
        try {
            const tokensArray = Array.isArray(job.tokens) ? job.tokens : []
            const tokenChunks = chunkArray(tokensArray, BATCH_SIZE)

            for (const tokens of tokenChunks) {
                const payload = {
                    tokens,
                    notification: {
                        body: job.content,
                        title: job.title
                    }
                }

                const response = await fetch("http://127.0.0.1:4004/", {
                    method: "POST",
                    body: JSON.stringify(payload),
                    headers: { "Content-Type": "application/json" }
                })

                if (!response.ok) {
                    console.error(`Batch failed for job ${job.id}:`, await response.text())
                    throw new Error("Batch failed")
                }

                console.log(`Batch sent for job ${job.id} (${tokens.length} tokens)`)
            }

            // Mark job as sent if all batches succeeded
            await prisma.scheduledNotification.update({
                where: { id: job.id },
                data: { status: "sent" }
            })

        } catch (err) {
            console.error("Error sending scheduled notification:", err)

            // Mark job as failed
            await prisma.scheduledNotification.update({
                where: { id: job.id },
                data: { status: "failed" }
            })
        }
    }
})
