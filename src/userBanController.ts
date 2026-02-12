import { Request, Response } from 'express';
import { prisma, UserRole } from './misc';

export async function banStudent(req: Request, res: Response) {
    const { studentId, reason, issuerId } = req.body;
    const role = req.role;

    if (!studentId || !reason || !issuerId) {
        return res.status(400).json({ success: false, message: "Student ID, reason, and issuer ID are required" });
    }

    try {
        const studentIdNum = parseInt(studentId);
        const issuerIdNum = parseInt(issuerId);

        if (isNaN(studentIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid Student ID" });
        }
        if (isNaN(issuerIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid Issuer ID" });
        }

        const student = await prisma.endUsers.findUnique({ where: { id: studentIdNum } });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        let bannedByMentorId: number | null = null;
        let bannedByAdminId: number | null = null;

        if (role === UserRole.mentor) {
            bannedByMentorId = issuerIdNum;
        } else if (role === UserRole.admin || role === UserRole.subAdmin || role === "subadmin") {
            bannedByAdminId = issuerIdNum;
        }

        const result = await prisma.$transaction([
            prisma.endUsers.update({
                where: { id: studentIdNum },
                data: { isBanned: true }
            }),
            prisma.banRecord.create({
                data: {
                    studentId: studentIdNum,
                    reason,
                    bannedByMentorId,
                    bannedByAdminId,
                }
            })
        ]);

        res.json({ success: true, message: "Student banned successfully", result });
    } catch (error) {
        console.error("Error banning student:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function unbanStudent(req: Request, res: Response) {
    const { studentId, issuerId } = req.body;
    const role = req.role;

    // Only allow admin or subadmin to unban
    const isAdmin = role === UserRole.admin || role === UserRole.subAdmin || role === "subadmin";
    if (!isAdmin) {
        return res.status(403).json({ success: false, message: "Only administrators can unban students" });
    }

    if (!studentId || !issuerId) {
        return res.status(400).json({ success: false, message: "Student ID and issuer ID are required" });
    }

    try {
        const studentIdNum = parseInt(studentId);
        const issuerIdNum = parseInt(issuerId);

        if (isNaN(studentIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid Student ID" });
        }
        if (isNaN(issuerIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid Issuer ID" });
        }

        const student = await prisma.endUsers.findUnique({ where: { id: studentIdNum } });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        if (!student.isBanned) {
            return res.status(400).json({ success: false, message: "Student is not banned" });
        }

        const activeBan = await prisma.banRecord.findFirst({
            where: { studentId: studentIdNum, unbannedAt: null },
            orderBy: { bannedAt: 'desc' }
        });

        await prisma.$transaction(async (tx) => {
            await tx.endUsers.update({
                where: { id: studentIdNum },
                data: { isBanned: false }
            });

            if (activeBan) {
                await tx.banRecord.update({
                    where: { id: activeBan.id },
                    data: {
                        unbannedAt: new Date(),
                        unbannedByAdminId: issuerIdNum
                    }
                });
            }
        });

        res.json({ success: true, message: "Student unbanned successfully" });
    } catch (error) {
        console.error("Error unbanning student:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function banStudentWebhook(req: Request, res: Response) {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.toString().replace("Bearer ", "");

        if (!token || token !== process.env.BAN_WEBHOOK_TOKEN) {
            return res.status(403).json({ success: false, message: "Unauthorized webhook" });
        }

        const { studentId, reason, issuerId } = req.body;

        if (!studentId || !reason || !issuerId) {
            return res.status(400).json({ success: false, message: "Student ID, reason, and issuer ID are required" });
        }
        const studentIdNum = parseInt(studentId);
        const issuerIdNum = parseInt(issuerId);

        if (isNaN(studentIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid Student ID" });
        }
        if (isNaN(issuerIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid Issuer ID" });
        }

        const student = await prisma.endUsers.findUnique({ where: { id: studentIdNum } });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        const result = await prisma.$transaction([
            prisma.endUsers.update({
                where: { id: studentIdNum },
                data: { isBanned: true }
            }),
            prisma.banRecord.create({
                data: {
                    studentId: studentIdNum,
                    reason: `[WEBHOOK] ${reason}`,
                    bannedByMentorId: issuerIdNum, // Assuming webhooks act as admin
                }
            })
        ]);

        res.json({ success: true, message: "Student banned via webhook successfully", result });
    } catch (error) {
        console.error("Error banning student via webhook:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}
