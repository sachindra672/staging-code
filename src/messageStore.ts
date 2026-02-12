import path from "path";
import { Request, Response } from "express";
import fs from 'fs';
import { Pool } from "pg"
import { prisma } from "./misc";

const MessageInsertQuery = `INSERT INTO "Messages"("toUUID", "fromUUID", type, content, "createdOn", "isRead")  VALUES ($1, $2, $3, $4, NOW(), $5)  RETURNING *;`;
const MarkMessagesReadQuery = ` UPDATE Messages  SET "isRead" = true WHERE id = ANY($1::bigint[]);`;

const pool = new Pool({
    user: 'SISYA192025',
    host: '10.160.0.47',
    database: 'sisya',
    password: 'SISYACLASS192025',
    port: 5432,
});


export async function insertMessage(to: string, from: string, type: string, content: string, isread: boolean) {
    try {
        console.log()
        await pool.query(MessageInsertQuery, [to, from, type, content, isread]);
    } catch (err) {
        console.error('Error inserting message:', err);
        const fallbackMessage = { to, from, type, content, createdOn: new Date() };
        writeMessageToFile(fallbackMessage);
    }
}

export async function MarkMessageIDsRead(req: Request, res: Response) {
    const { ReadIDs } = req.body
    try {
        await pool.query(MarkMessagesReadQuery, [ReadIDs]);
        res.send("done")
    } catch (error) {
        console.log(error)
        res.status(500).send(error)
    }
}

export async function GetMessages(req: Request, res: Response) {
    const { isRead, toUUID } = req.body
    try {
        const messages = await prisma.messages.findMany({ where: { isRead, toUUID } })
        res.json({ success: true, messages })
    } catch (error) {
        res.status(500).send({ success: false, cause: error })
    }
}

export async function getMessagesByUUID(req: Request, res: Response): Promise<void> {
    const { uuid } = req.body;

    try {
        const distinctCombinations = await prisma.$queryRaw<{ toUUID: string, fromUUID: string }[]>`
        SELECT DISTINCT "toUUID", "fromUUID"
        FROM "Messages"
        WHERE "toUUID" = ${uuid} OR "fromUUID" = ${uuid}
      `;

        const allMessages = [];

        for (const combination of distinctCombinations) {
            const { toUUID, fromUUID } = combination;

            const messages = await prisma.messages.findMany({
                where: {
                    AND: [
                        { toUUID: toUUID },
                        { fromUUID: fromUUID },
                    ],
                },
                orderBy: { createdOn: 'desc' },
                take: 50,
            });

            allMessages.push(...messages);
        }

        res.json(allMessages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching messages.' });
    }
}

export async function getChatHistoryParticipants(req: Request, res: Response): Promise<void> {
    const { uuid } = req.body;

    try {
        const distinctCombinations = await prisma.$queryRaw<{ toUUID: string, fromUUID: string }[]>`
        SELECT DISTINCT "toUUID", "fromUUID"
        FROM "Messages"
        WHERE "toUUID" = ${uuid} OR "fromUUID" = ${uuid}
      `;

        let UUIds = [];

        for (const combination of distinctCombinations) {
            const { toUUID, fromUUID } = combination;

            UUIds.push(toUUID, fromUUID)
        }

        UUIds = [...new Set(UUIds)]
        const users = await prisma.endUsers.findMany({ where: { uuid: { in: UUIds } }, select: { id: true, uuid: true, name: true } })
        const mentors = await prisma.mentor.findMany({ where: { uuid: { in: UUIds } }, select: { id: true, uuid: true, name: true } })

        res.json({ success: true, users, mentors });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while fetching messages.' });
    }
}


export async function GetRecentChatPartners(req: Request, res: Response): Promise<void> {
    const { uuid } = req.body;

    try {
        const distinctCombinations = await prisma.$queryRaw<{ toUUID: string, fromUUID: string }[]>`
        SELECT DISTINCT "toUUID", "fromUUID"
        FROM "Messages"
        WHERE "toUUID" = ${uuid} OR "fromUUID" = ${uuid}
      `;

        let UUIds = [];

        for (const combination of distinctCombinations) {
            const { toUUID, fromUUID } = combination;

            UUIds.push(toUUID, fromUUID)
        }

        UUIds = [...new Set(UUIds)]
        const users = await prisma.endUsers.findMany({ where: { uuid: { in: UUIds } }, select: { id: true, uuid: true, name: true } })
        const mentors = await prisma.mentor.findMany({ where: { uuid: { in: UUIds } }, select: { id: true, uuid: true, name: true } })

        res.json({ success: true, users, mentors });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while fetching messages.' });
    }
}

export async function GetConversationn(req: Request, res: Response): Promise<void> {
    const { toUUID, fromUUID } = req.body

    try {
        const toFrom = await prisma.messages.findMany({ where: { AND: [{ toUUID: toUUID }, { fromUUID: fromUUID },] } })
        const fromTo = await prisma.messages.findMany({ where: { AND: [{ toUUID: fromUUID }, { fromUUID: toUUID },] } })
        const chat = [...toFrom, ...fromTo];
        chat.sort((a, b) => b.createdOn.getTime() - a.createdOn.getTime());
        res.json({ success: true, chat })
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while fetching messages.' });
    }
}


export async function markMessagesAsRead(messageIds: number[]) {
    try {
        const res = await pool.query(MarkMessagesReadQuery, [messageIds]);
        console.log('Messages marked as read:', res.rowCount);
    } catch (err) {
        console.error('Error updating messages:', err);
    }
}

function writeMessageToFile(message: { to: string, from: string, type: string, content: string, createdOn: Date }) {
    const filePath = path.join(__dirname, 'fallbackMessages.json');
    let messages = [];

    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        messages = JSON.parse(fileContent);
    }

    messages.push(message);

    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
    console.log('Message written to fallback file:', message);
}

export async function GetMyUUID(req: Request, res: Response): Promise<void> {
    const { id, role } = req.body

    if (role == "mentor") {
        const mentorUUId = await prisma.mentor.findFirst({ where: { id }, select: { uuid: true } })
        res.json(mentorUUId)
        return
    }

    if (role == "user") {
        const endUser = await prisma.endUsers.findFirst({ where: { id }, select: { uuid: true } })
        res.json(endUser)
        return
    }

    res.status(400).send("something went wrong")
}