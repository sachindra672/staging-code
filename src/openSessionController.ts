import { prisma } from './misc'
import { Request, Response } from 'express'
import { createClassVM } from './vm_management/vm';

export const createOpenSession = async (req: Request, res: Response) => {
    try {
        const { mentorId, title, description, grade, startTime, endTime } = req.body;

        // Basic validation
        if (!mentorId || !title || !startTime) {
            return res.status(400).json({
                error: "mentorId, title, and startTime are required fields",
            });
        }

        // Validate date formats
        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : null;

        if (isNaN(start.getTime())) {
            return res.status(400).json({ error: "Invalid startTime format" });
        }

        if (end && isNaN(end.getTime())) {
            return res.status(400).json({ error: "Invalid endTime format" });
        }

        if (end && end <= start) {
            return res.status(400).json({ error: "endTime must be after startTime" });
        }

        // Create session
        const session = await prisma.openSession.create({
            data: {
                mentorId,
                title,
                description: description || null,
                grade: grade || null,
                startTime: start,
                endTime: end,
            },
        });

        return res.status(201).json(session);
    } catch (err: any) {
        console.error("Error creating open session:", err);

        // Handle known Prisma errors
        if (err.code === "P2003") {
            // Foreign key constraint failed
            return res.status(400).json({ error: "Invalid mentorId" });
        }

        return res.status(500).json({ error: "Internal server error" });
    }
};

export const getOpenSessions = async (req: Request, res: Response) => {
    try {
        const { grade } = req.body;

        if (grade && typeof grade !== "string") {
            return res.status(400).json({ error: "Grade must be a string" });
        }

        const where: any = {};
        if (grade) where.grade = grade;

        const sessions = await prisma.openSession.findMany({
            where,
            include: {
                mentor:true,
                bookings: true,
                attendance: true,
                quizzes: true,
                feedbacks: true,
            },
            orderBy: { startTime: "desc" }, 
        });

        return res.status(200).json(sessions);
    } catch (err: any) {
        console.error("Error fetching open sessions:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const getOpenSessionById = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        // Validate id
        if (!id || typeof id !== "number") {
            return res.status(400).json({ error: "Valid session id is required" });
        }

        const session = await prisma.openSession.findUnique({
            where: { id },
            include: {
                mentor: true,
                bookings: { include: { user: true } },
                attendance: { include: { user: true, intervals: true } },
                quizzes: { include: { responses: true } },
                feedbacks: { include: { student: true } },
            },
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        return res.status(200).json(session);
    } catch (err: any) {
        console.error("Error fetching open session by id:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const updateOpenSession = async (req: Request, res: Response) => {
    try {
        const { id, ...data } = req.body;

        // Validate id
        if (!id || typeof id !== "number") {
            return res.status(400).json({ error: "Valid session id is required" });
        }

        // Optional: Validate startTime/endTime if included
        if (data.startTime) {
            const start = new Date(data.startTime);
            if (isNaN(start.getTime())) {
                return res.status(400).json({ error: "Invalid startTime format" });
            }
            data.startTime = start;
        }

        if (data.endTime) {
            const end = new Date(data.endTime);
            if (isNaN(end.getTime())) {
                return res.status(400).json({ error: "Invalid endTime format" });
            }
            data.endTime = end;
        }

        if (data.startTime && data.endTime && data.endTime <= data.startTime) {
            return res.status(400).json({ error: "endTime must be after startTime" });
        }

        const session = await prisma.openSession.update({
            where: { id },
            data,
        });

        return res.status(200).json(session);
    } catch (err: any) {
        console.error("Error updating open session:", err);

        // Handle known Prisma errors
        if (err.code === "P2025") {
            // Record not found
            return res.status(404).json({ error: "Session not found" });
        }

        return res.status(500).json({ error: "Internal server error" });
    }
};

export const startOpenSession = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ error: "id is required" });
        }

   //     const randomNumber = Math.floor(100000 + Math.random() * 900000).toString();
          const checksession = await prisma.openSession.findUnique({
            where: { id: id },
            select: { randomNumber: true }  
        });
        console.log("Check session vmIp:", checksession?.randomNumber);

        if(!checksession?.randomNumber){
        console.log("Creating VM for open session id:", id);
        const response = await createClassVM(id);
        const socket_url = response.domain;
        console.log("VM created with URL:", socket_url);
        const session = await prisma.openSession.update({
            where: { id },
            data: {
                isGoingOn: true,
                randomNumber: socket_url,
            }
        });

        

        return res.status(200).json(session);
    }else{
        console.log("VM already exists for open session id:", id);
        const session = await prisma.openSession.update({
            where: { id },
            data: {
                isGoingOn: true,
            }
        });

        return res.status(200).json(session);
    }

    } catch (err: any) {
        console.error("Error updating open session:", err);

        if (err.code === "P2025") {
            return res.status(404).json({ error: "Session not found" });
        }

        return res.status(500).json({ error: "Internal server error" });
    }
};


export const deleteOpenSession = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        if (!id || typeof id !== "number") {
            return res.status(400).json({ error: "Valid numeric session id is required" });
        }

        const existingSession = await prisma.openSession.findUnique({
            where: { id },
        });

        if (!existingSession) {
            return res.status(404).json({ error: "Session not found" });
        }

        await prisma.openSessionAttendance.deleteMany({ where: { openSessionId: id } });
        await prisma.openSessionBooking.deleteMany({ where: { openSessionId: id } });
        await prisma.openSessionFeedback.deleteMany({ where: { openSessionId: id } });
        await prisma.openSessionQuiz.deleteMany({ where: { openSessionId: id } });

        const deletedSession = await prisma.openSession.delete({
            where: { id },
        });

        return res.status(200).json({
            message: "Open session and related data deleted successfully",
            session: deletedSession,
        });
    } catch (err: any) {
        console.error("Error deleting open session:", err);

        if (err.code === "P2025") {
            return res.status(404).json({ error: "Session not found" });
        }

        return res.status(500).json({ error: "Internal server error" });
    }
};

export const bookSession = async (req: Request, res: Response) => {
    try {
        const { sessionId, userId } = req.body;

        // Validate input
        if (!sessionId || typeof sessionId !== "number") {
            return res.status(400).json({ error: "Valid sessionId is required" });
        }

        if (!userId || typeof userId !== "number") {
            return res.status(400).json({ error: "Valid userId is required" });
        }

        // Check if already booked
        const alreadyBooked = await prisma.openSessionBooking.findFirst({
            where: {
                openSessionId: sessionId,
                userId
            }
        });

        if (alreadyBooked) {
            return res.status(409).json({
                error: "You have already booked this session"
            });
        }

        // Create new booking
        const booking = await prisma.openSessionBooking.create({
            data: {
                openSessionId: sessionId,
                userId,
            },
        });

        return res.status(201).json(booking);
    } catch (err: any) {
        console.error("Error booking session:", err);

        if (err.code === "P2003") {
            return res.status(400).json({ error: "Invalid sessionId or userId" });
        }

        return res.status(500).json({ error: "Internal server error" });
    }
};





