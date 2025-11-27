import { generateAccessTokenAdmin } from './adminFuncs'
import { prisma, verifyPassword } from './misc'
import { Request, Response } from 'express'


export async function GetMentorCourses(req: Request, res: Response) {
    const { mentorId } = req.body

    try {
        const BigCourseIdList = (await prisma.teachIntro.findMany({ where: { mentorId } })).map(e => e.bigCourseId)
        const courseIds = Array.from(new Set(BigCourseIdList))
        const bigCourses = await prisma.bigCourse.findMany({ where: { id: { in: courseIds } }, include: { session: true, TeachIntro: true } })

        res.json({ success: true, bigCourses })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function MentorLogin(req: Request, res: Response) {
    const { email, password } = req.body

    try {
        const mentor = await prisma.mentor.findFirst({ where: { email } })
        if (mentor) {
            await verifyPassword(password, mentor.passHash) ?
                res.json({ success: true, token: generateAccessTokenAdmin(mentor) }) :
                res.status(401).json({ success: false, message: "check username or password" })
        } else {
            res.status(404).send({ success: false, message: "user not found with given name" })
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error })
    }
}

export async function GetMentor(req: Request, res: Response) {
    const { mentorId } = req.body
    try {
        const mentor = await prisma.mentor.findUniqueOrThrow({ where: { id: mentorId } })
        res.json({ success: true, mentor })
    } catch (error) {
        console.error(error)
        res.json({ success: false, error })
    }
}

export async function InsertMentorRating(req: Request, res: Response) {
    const { rating, comment, userId, mentorId } = req.body

    try {
        const nrating = await prisma.mentorRatings.create({ data: { rating, comment, userId, mentorId } })
        res.json({ success: true, nrating })
    } catch (error) {
        console.error(error)
        res.json({ success: false, error })
    }
}

export async function GetMentorRatings(req: Request, res: Response) {
    try {
        const { mentorId, page = 1, limit = 100, filter } = req.body;

        if (!mentorId) {
            return res.status(400).json({ success: false, error: "mentorId is required" });
        }

        const skip = (page - 1) * limit;

        let whereCondition: any = { mentorId };

        if (filter) {
            if (filter === "poor") {
                whereCondition.rating = { gte: 1, lt: 2 };
            } else if (filter === "avg") {
                whereCondition.rating = { gte: 2, lt: 3 };
            } else if (filter === "good") {
                whereCondition.rating = { gte: 3, lt: 4 };
            } else if (filter === "excellent") {
                whereCondition.rating = { gte: 4, lte: 5 };
            }
        }

        // Avg rating
        const avg = await prisma.mentorRatings.aggregate({
            _avg: { rating: true },
            where: { mentorId },
        });

        // Ratings with student details
        const ratings = await prisma.mentorRatings.findMany({
            where: whereCondition,
            select: {
                rating: true,
                comment: true,
                createdOn: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            skip,
            take: limit,
            orderBy: filter === "recent" ? { createdOn: "desc" } : { createdOn: "asc" },
        });

        const totalCount = await prisma.mentorRatings.count({ where: whereCondition });

        res.json({
            success: true,
            avgRating: avg._avg.rating || 0,
            total: totalCount,
            page,
            limit,
            ratings,
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, error });
    }
}

