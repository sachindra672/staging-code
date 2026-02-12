import { Request, Response } from "express";
import { prisma } from './misc'
import { grantTaskReward } from './sisyacoin/taskRewardController'
import { getSystemWallet } from './config/sisyacoinHelperFunctions'
import { Decimal } from "@prisma/client/runtime/library";

export async function getAllQuizzes(req: Request, res: Response) {
    try {
        const { page = 1, limit = 10, sessionId } = req.body || {};

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (pageNumber <= 0 || pageSize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be positive numbers",
            });
        }

        const skip = (pageNumber - 1) * pageSize;

        // Build where clause
        const where: any = {};
        if (sessionId) {
            where.sessionId = Number(sessionId);
        }

        const [quizzes, total] = await Promise.all([
            prisma.sisyaClassQuiz.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
                include: {
                    session: {
                        select: {
                            id: true,
                            detail: true,
                            startTime: true,
                            endTime: true,
                            mentor: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    responses: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    phone: true,
                                },
                            },
                        },
                        orderBy: { createdAt: "desc" },
                    },
                },
            }),
            prisma.sisyaClassQuiz.count({ where }),
        ]);

        return res.json({
            success: true,
            data: quizzes,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        console.error("Error fetching quizzes:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// Alternative: Get quiz with response statistics
export async function getQuizWithStats(req: Request, res: Response) {
    try {
        const { quizId } = req.params;

        if (!quizId) {
            return res.status(400).json({
                success: false,
                message: "Quiz ID is required",
            });
        }

        const quiz = await prisma.sisyaClassQuiz.findUnique({
            where: { id: Number(quizId) },
            include: {
                session: {
                    select: {
                        id: true,
                        detail: true,
                        startTime: true,
                        endTime: true,
                        mentor: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                responses: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
                    },
                    orderBy: [
                        { isCorrect: "desc" },
                        { timeTaken: "asc" },
                    ],
                },
            },
        });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "Quiz not found",
            });
        }

        // Calculate statistics
        const totalResponses = quiz.responses.length;
        const correctResponses = quiz.responses.filter((r) => r.isCorrect).length;
        const incorrectResponses = totalResponses - correctResponses;
        const averageTime = totalResponses > 0
            ? quiz.responses.reduce((sum, r) => sum + r.timeTaken, 0) / totalResponses
            : 0;

        // Get top 3 performers
        const topPerformers = quiz.responses
            .filter((r) => r.isCorrect)
            .sort((a, b) => a.timeTaken - b.timeTaken)
            .slice(0, 3)
            .map((r) => ({
                userId: r.userId,
                userName: r.user.name,
                timeTaken: r.timeTaken,
                selectedAnswer: r.selectedAnswer,
            }));

        return res.json({
            success: true,
            data: {
                ...quiz,
                statistics: {
                    totalResponses,
                    correctResponses,
                    incorrectResponses,
                    accuracy: totalResponses > 0 ? (correctResponses / totalResponses) * 100 : 0,
                    averageTime: Math.round(averageTime),
                    topPerformers,
                },
            },
        });
    } catch (error) {
        console.error("Error fetching quiz with stats:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// POST: Create a new quiz
export async function createQuiz(req: Request, res: Response) {
    try {
        const {
            sessionId,
            quizId,
            title,
            type,
            question,
            correctAnswer,
            options,
            timerDuration,
            timerEndsAt,
        } = req.body;

        // Validation
        if (!sessionId || !quizId || !title || !type || !correctAnswer) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: sessionId, quizId, title, type, correctAnswer",
            });
        }

        // Verify session exists
        const session = await prisma.session.findUnique({
            where: { id: Number(sessionId) },
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        // Create quiz
        const quiz = await prisma.sisyaClassQuiz.create({
            data: {
                sessionId: Number(sessionId),
                quizId: String(quizId),
                title: String(title),
                type: String(type),
                question: question || null,
                correctAnswer: String(correctAnswer),
                options: options || null,
                timerDuration: Number(timerDuration) || 10,
                timerEndsAt: timerEndsAt ? new Date(timerEndsAt) : null,
                isActive: true,
            },
            include: {
                session: {
                    select: {
                        id: true,
                        detail: true,
                    },
                },
            },
        });

        return res.json({
            success: true,
            message: "Quiz created successfully",
            data: quiz,
        });
    } catch (error: any) {
        console.error("Error creating quiz:", error);

        // Handle unique constraint violation (if quizId is unique)
        if (error.code === "P2002") {
            return res.status(400).json({
                success: false,
                message: "Quiz with this ID already exists",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// POST: Submit a quiz response
export async function submitQuizResponse(req: Request, res: Response) {
    try {
        const {
            quizId,
            userId,
            selectedAnswer,
            timeTaken,
        } = req.body;

        // Validation
        if (!quizId || !userId || !selectedAnswer || timeTaken === undefined) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: quizId, userId, selectedAnswer, timeTaken",
            });
        }

        // Find quiz to get correct answer
        const quiz = await prisma.sisyaClassQuiz.findFirst({
            where: {
                OR: [
                    { id: Number(quizId) },
                    { quizId: String(quizId) },
                ],
            },
        });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "Quiz not found",
            });
        }

        if (!quiz.isActive) {
            return res.status(400).json({
                success: false,
                message: "Quiz is not active",
            });
        }

        // Verify user exists
        const user = await prisma.endUsers.findUnique({
            where: { id: Number(userId) },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if user already submitted a response for this quiz
        const existingResponse = await prisma.sisyaClassQuizResponse.findFirst({
            where: {
                quizId: quiz.id,
                userId: Number(userId),
            },
        });

        if (existingResponse) {
            return res.status(400).json({
                success: false,
                message: "Response already submitted for this quiz",
            });
        }

        // Determine if answer is correct
        const isCorrect = selectedAnswer.toLowerCase() === quiz.correctAnswer.toLowerCase();

        // Create response
        const response = await prisma.sisyaClassQuizResponse.create({
            data: {
                quizId: quiz.id,
                userId: Number(userId),
                selectedAnswer: String(selectedAnswer),
                timeTaken: Number(timeTaken),
                isCorrect,
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
        });

        return res.json({
            success: true,
            message: "Response submitted successfully",
            data: response,
        });
    } catch (error: any) {
        console.error("Error submitting quiz response:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function endQuiz(req: Request, res: Response) {
    try {
        const { quizId, responses } = req.body;

        if (!quizId) {
            return res.status(400).json({
                success: false,
                message: "Quiz ID is required",
            });
        }

        const orConditions: any[] = [{ quizId: String(quizId) }];
        const numericId = Number(quizId);

        if (!isNaN(numericId) && isFinite(numericId)) {
            orConditions.unshift({ id: numericId });
        }

        // Find quiz
        const quiz = await prisma.sisyaClassQuiz.findFirst({
            where: { OR: orConditions },
        });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "Quiz not found",
            });
        }

        // Update quiz to inactive and set endedAt
        await prisma.sisyaClassQuiz.update({
            where: { id: quiz.id },
            data: {
                isActive: false,
                endedAt: new Date(),
            },
        });

        if (responses && Array.isArray(responses) && responses.length > 0) {
            const responseData = responses
                .map((r: any) => {
                    const userId = Number(r.userId);

                    if (isNaN(userId) || !isFinite(userId)) return null;

                    const isCorrect =
                        r.selectedAnswer?.toLowerCase() ===
                        quiz.correctAnswer.toLowerCase();

                    return {
                        quizId: quiz.id,
                        userId,
                        selectedAnswer: String(r.selectedAnswer || ""),
                        timeTaken: Number(r.timeTaken || 0),
                        isCorrect,
                    };
                })
                .filter((r: any) => r !== null);

            const userIds = responseData.map((r) => r.userId);

            const validUsers = await prisma.endUsers.findMany({
                where: { id: { in: userIds } },
                select: { id: true },
            });

            const validUserIds = new Set(validUsers.map((u) => u.id));

            const filteredResponses = responseData.filter((r) =>
                validUserIds.has(r.userId)
            );

            const invalidResponses = responseData.filter(
                (r) => !validUserIds.has(r.userId)
            );

            if (invalidResponses.length > 0) {
                console.warn(
                    "Skipping invalid quiz responses (invalid userId):",
                    invalidResponses
                );
            }

            // Bulk create responses safely
            if (filteredResponses.length > 0) {
                await prisma.sisyaClassQuizResponse.createMany({
                    data: filteredResponses,
                    skipDuplicates: true,
                });
            }
        }

        // Get updated quiz + responses
        const updatedQuiz = await prisma.sisyaClassQuiz.findUnique({
            where: { id: quiz.id },
            include: {
                responses: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: [
                        { isCorrect: "desc" },
                        { timeTaken: "asc" },
                    ],
                },
            },
        });

        // Calculate top performers (only from correct answers)
        const correctResponses =
            updatedQuiz?.responses
                .filter((r) => r.isCorrect)
                .sort((a, b) => a.timeTaken - b.timeTaken) || [];

        const topPerformers = correctResponses.slice(0, 3).map((r) => ({
            userId: r.userId,
            userName: r.user.name,
            timeTaken: r.timeTaken,
            selectedAnswer: r.selectedAnswer,
        }));

        // Create a map of top performer positions (userId -> position)
        const topPerformerMap = new Map<number, number>();
        topPerformers.forEach((performer, index) => {
            topPerformerMap.set(performer.userId, index + 1);
        });

        // Get ALL participants (not just correct ones)
        const allResponses = updatedQuiz?.responses || [];

        // Reward system - give base reward to ALL participants
        const rewardResults: any[] = [];
        const baseReward = 10;
        const bonuses = [10, 5, 3];

        const systemWallet = await getSystemWallet();
        const totalParticipants = allResponses.length;

        // Calculate total coins needed: base for all + bonuses for top 3
        const totalCoinsNeeded =
            baseReward * totalParticipants +
            (topPerformers[0] ? bonuses[0] : 0) +
            (topPerformers[1] ? bonuses[1] : 0) +
            (topPerformers[2] ? bonuses[2] : 0);

        const totalCoinsNeededDecimal = new Decimal(totalCoinsNeeded);

        if (systemWallet.spendableBalance.lt(totalCoinsNeededDecimal)) {
            console.warn(
                `System wallet insufficient. Available: ${systemWallet.spendableBalance}, Required: ${totalCoinsNeeded}`
            );
        } else {
            // Grant rewards to ALL participants
            for (const response of allResponses) {
                const position = topPerformerMap.get(response.userId);
                const isTop = position !== undefined;

                let coinsAmount = baseReward;
                let reasonParts = [`Base participation reward: ${baseReward} coins`];

                // Add position bonus only if they're in top 3
                if (isTop && position) {
                    const bonus = bonuses[position - 1];
                    coinsAmount += bonus;
                    reasonParts.push(`Position ${position} bonus: +${bonus} coins`);
                }

                const taskCode = `QUIZ_${quiz.id}_${response.userId}`;
                const amountDecimal = new Decimal(coinsAmount);
                const reason = `Quiz participation - ${reasonParts.join(", ")}`;

                try {
                    if (systemWallet.spendableBalance.lt(amountDecimal)) {
                        rewardResults.push({
                            userId: response.userId,
                            userName: response.user.name,
                            success: false,
                            message: "Insufficient system wallet balance",
                            coinsEarned: 0,
                        });
                        continue;
                    }

                    const rewardReq = {
                        body: {
                            userId: response.userId,
                            taskCode,
                            coinsAmount,
                            reason,
                            metadata: {
                                quizId: quiz.id,
                                quizTitle: quiz.title,
                                position: isTop ? position : null,
                                isCorrect: response.isCorrect,
                                timeTaken: response.timeTaken,
                            },
                        },
                    } as Request;

                    let rewardResponseData: any = null;

                    const rewardRes = {
                        json: (data: any) => {
                            rewardResponseData = data;
                        },
                        status: (_code: number) => ({
                            json: (data: any) => {
                                rewardResponseData = data;
                            },
                        }),
                    } as unknown as Response;

                    await grantTaskReward(rewardReq, rewardRes);

                    if (rewardResponseData?.success) {
                        rewardResults.push({
                            userId: response.userId,
                            userName: response.user.name,
                            success: true,
                            coinsEarned: coinsAmount,
                            message: reasonParts.join(", "),
                            position: isTop ? position : null,
                            userWallet: rewardResponseData.data?.userWallet || null,
                        });
                    } else {
                        rewardResults.push({
                            userId: response.userId,
                            userName: response.user.name,
                            success: false,
                            message:
                                rewardResponseData?.message || "Reward grant failed",
                            coinsEarned: 0,
                        });
                    }
                } catch (err) {
                    console.error(
                        `Error granting reward to user ${response.userId}:`,
                        err
                    );
                    rewardResults.push({
                        userId: response.userId,
                        userName: response.user.name,
                        success: false,
                        message: "Error processing reward",
                        coinsEarned: 0,
                    });
                }
            }
        }

        return res.json({
            success: true,
            message: "Quiz ended successfully",
            data: {
                quiz: updatedQuiz,
                topPerformers,
                rewards: {
                    totalParticipants,
                    totalCoinsDistributed: rewardResults
                        .filter((r) => r.success)
                        .reduce((sum, r) => sum + (r.coinsEarned || 0), 0),
                    results: rewardResults,
                },
            },
        });
    } catch (error) {
        console.error("Error ending quiz:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// POST: Get leaderboard for a particular session
export async function getLeaderboardBySession(req: Request, res: Response) {
    try {
        const { sessionId, page = 1, limit = 50 } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Session ID is required",
            });
        }

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (pageNumber <= 0 || pageSize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be positive numbers",
            });
        }

        // Verify session exists
        const session = await prisma.session.findUnique({
            where: { id: Number(sessionId) },
            include: {
                course: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found",
            });
        }

        // Get all quizzes for this session
        const quizzes = await prisma.sisyaClassQuiz.findMany({
            where: {
                sessionId: Number(sessionId),
                isActive: false, // Only include ended quizzes
            },
            include: {
                responses: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        // Aggregate leaderboard data by user
        const leaderboardMap = new Map<number, {
            userId: number;
            userName: string;
            userEmail: string;
            totalQuizzes: number;
            correctAnswers: number;
            incorrectAnswers: number;
            totalTimeTaken: number;
            averageTimeTaken: number;
            accuracy: number;
            score: number;
        }>();

        quizzes.forEach((quiz) => {
            quiz.responses.forEach((response) => {
                const userId = response.userId;
                const existing = leaderboardMap.get(userId);

                if (existing) {
                    existing.totalQuizzes += 1;
                    existing.correctAnswers += response.isCorrect ? 1 : 0;
                    existing.incorrectAnswers += response.isCorrect ? 0 : 1;
                    existing.totalTimeTaken += response.timeTaken;
                    existing.averageTimeTaken = existing.totalTimeTaken / existing.totalQuizzes;
                    existing.accuracy = (existing.correctAnswers / existing.totalQuizzes) * 100;
                    // Score = correct answers * 100 points per quiz
                    existing.score += response.isCorrect ? 100 : 0;
                } else {
                    leaderboardMap.set(userId, {
                        userId,
                        userName: response.user.name,
                        userEmail: response.user.email,
                        totalQuizzes: 1,
                        correctAnswers: response.isCorrect ? 1 : 0,
                        incorrectAnswers: response.isCorrect ? 0 : 1,
                        totalTimeTaken: response.timeTaken,
                        averageTimeTaken: response.timeTaken,
                        accuracy: response.isCorrect ? 100 : 0,
                        score: response.isCorrect ? 100 : 0,
                    });
                }
            });
        });

        // Convert to array and sort by score (descending), then by average time (ascending)
        let leaderboard = Array.from(leaderboardMap.values()).sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.averageTimeTaken - b.averageTimeTaken;
        });

        // Add rank
        leaderboard = leaderboard.map((entry, index) => ({
            ...entry,
            rank: index + 1,
        }));

        // Pagination
        const skip = (pageNumber - 1) * pageSize;
        const paginatedLeaderboard = leaderboard.slice(skip, skip + pageSize);

        // Prepare quiz details
        const quizDetails = quizzes.map((quiz) => {
            const totalResponses = quiz.responses.length;
            const correctResponses = quiz.responses.filter((r) => r.isCorrect).length;
            return {
                id: quiz.id,
                quizId: quiz.quizId,
                title: quiz.title,
                type: quiz.type,
                question: quiz.question,
                correctAnswer: quiz.correctAnswer,
                options: quiz.options,
                timerDuration: quiz.timerDuration,
                createdAt: quiz.createdAt,
                endedAt: quiz.endedAt,
                statistics: {
                    totalResponses,
                    correctResponses,
                    incorrectResponses: totalResponses - correctResponses,
                    accuracy: totalResponses > 0 ? (correctResponses / totalResponses) * 100 : 0,
                },
            };
        });

        return res.json({
            success: true,
            data: {
                session: {
                    id: session.id,
                    detail: session.detail,
                    startTime: session.startTime,
                    endTime: session.endTime,
                    course: session.course,
                },
                quizzes: {
                    total: quizzes.length,
                    details: quizDetails,
                },
                leaderboard: paginatedLeaderboard,
                pagination: {
                    total: leaderboard.length,
                    page: pageNumber,
                    limit: pageSize,
                    totalPages: Math.ceil(leaderboard.length / pageSize),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching session leaderboard:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// POST: Get leaderboard for a particular day
export async function getLeaderboardByDay(req: Request, res: Response) {
    try {
        const { date, page = 1, limit = 50 } = req.body || {};

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Date is required (format: YYYY-MM-DD)",
            });
        }

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (pageNumber <= 0 || pageSize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be positive numbers",
            });
        }

        // Parse date and create date range (start and end of day)
        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Use YYYY-MM-DD",
            });
        }

        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Get all sessions for this day
        const sessions = await prisma.session.findMany({
            where: {
                startTime: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            include: {
                sisyaClassQuizzes: {
                    where: {
                        isActive: false, // Only ended quizzes
                    },
                    include: {
                        responses: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Aggregate leaderboard data by user across all sessions of the day
        const leaderboardMap = new Map<number, {
            userId: number;
            userName: string;
            userEmail: string;
            totalQuizzes: number;
            correctAnswers: number;
            incorrectAnswers: number;
            totalTimeTaken: number;
            averageTimeTaken: number;
            accuracy: number;
            score: number;
            sessionsParticipated: Set<number>;
        }>();

        sessions.forEach((session) => {
            session.sisyaClassQuizzes.forEach((quiz) => {
                quiz.responses.forEach((response) => {
                    const userId = response.userId;
                    const existing = leaderboardMap.get(userId);

                    if (existing) {
                        existing.totalQuizzes += 1;
                        existing.correctAnswers += response.isCorrect ? 1 : 0;
                        existing.incorrectAnswers += response.isCorrect ? 0 : 1;
                        existing.totalTimeTaken += response.timeTaken;
                        existing.averageTimeTaken = existing.totalTimeTaken / existing.totalQuizzes;
                        existing.accuracy = (existing.correctAnswers / existing.totalQuizzes) * 100;
                        existing.score += response.isCorrect ? 100 : 0;
                        existing.sessionsParticipated.add(session.id);
                    } else {
                        const sessionsSet = new Set<number>();
                        sessionsSet.add(session.id);
                        leaderboardMap.set(userId, {
                            userId,
                            userName: response.user.name,
                            userEmail: response.user.email,
                            totalQuizzes: 1,
                            correctAnswers: response.isCorrect ? 1 : 0,
                            incorrectAnswers: response.isCorrect ? 0 : 1,
                            totalTimeTaken: response.timeTaken,
                            averageTimeTaken: response.timeTaken,
                            accuracy: response.isCorrect ? 100 : 0,
                            score: response.isCorrect ? 100 : 0,
                            sessionsParticipated: sessionsSet,
                        });
                    }
                });
            });
        });

        // Convert to array and sort by score (descending), then by average time (ascending)
        let leaderboard = Array.from(leaderboardMap.values())
            .map((entry) => ({
                ...entry,
                sessionsParticipated: entry.sessionsParticipated.size,
            }))
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return a.averageTimeTaken - b.averageTimeTaken;
            });

        // Add rank
        leaderboard = leaderboard.map((entry, index) => ({
            ...entry,
            rank: index + 1,
        }));

        // Pagination
        const skip = (pageNumber - 1) * pageSize;
        const paginatedLeaderboard = leaderboard.slice(skip, skip + pageSize);

        // Collect all quizzes with their details
        const allQuizzes: any[] = [];
        sessions.forEach((session) => {
            session.sisyaClassQuizzes.forEach((quiz) => {
                const totalResponses = quiz.responses.length;
                const correctResponses = quiz.responses.filter((r) => r.isCorrect).length;
                allQuizzes.push({
                    id: quiz.id,
                    quizId: quiz.quizId,
                    sessionId: session.id,
                    sessionDetail: session.detail,
                    title: quiz.title,
                    type: quiz.type,
                    question: quiz.question,
                    correctAnswer: quiz.correctAnswer,
                    options: quiz.options,
                    timerDuration: quiz.timerDuration,
                    createdAt: quiz.createdAt,
                    endedAt: quiz.endedAt,
                    statistics: {
                        totalResponses,
                        correctResponses,
                        incorrectResponses: totalResponses - correctResponses,
                        accuracy: totalResponses > 0 ? (correctResponses / totalResponses) * 100 : 0,
                    },
                });
            });
        });

        return res.json({
            success: true,
            data: {
                date: date,
                totalSessions: sessions.length,
                quizzes: {
                    total: allQuizzes.length,
                    details: allQuizzes,
                },
                leaderboard: paginatedLeaderboard,
                pagination: {
                    total: leaderboard.length,
                    page: pageNumber,
                    limit: pageSize,
                    totalPages: Math.ceil(leaderboard.length / pageSize),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching day leaderboard:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// POST: Get leaderboard for a particular course
export async function getLeaderboardByCourse(req: Request, res: Response) {
    try {
        const { courseId, page = 1, limit = 50 } = req.body || {};

        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required",
            });
        }

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (pageNumber <= 0 || pageSize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be positive numbers",
            });
        }

        // Verify course exists
        const course = await prisma.bigCourse.findUnique({
            where: { id: Number(courseId) },
            select: {
                id: true,
                name: true,
                description: true,
            },
        });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        // Get all sessions for this course
        const sessions = await prisma.session.findMany({
            where: {
                bigCourseId: Number(courseId),
            },
            include: {
                sisyaClassQuizzes: {
                    where: {
                        isActive: false, // Only ended quizzes
                    },
                    include: {
                        responses: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Aggregate leaderboard data by user across all sessions of the course
        const leaderboardMap = new Map<number, {
            userId: number;
            userName: string;
            userEmail: string;
            totalQuizzes: number;
            correctAnswers: number;
            incorrectAnswers: number;
            totalTimeTaken: number;
            averageTimeTaken: number;
            accuracy: number;
            score: number;
            sessionsParticipated: Set<number>;
        }>();

        sessions.forEach((session) => {
            session.sisyaClassQuizzes.forEach((quiz) => {
                quiz.responses.forEach((response) => {
                    const userId = response.userId;
                    const existing = leaderboardMap.get(userId);

                    if (existing) {
                        existing.totalQuizzes += 1;
                        existing.correctAnswers += response.isCorrect ? 1 : 0;
                        existing.incorrectAnswers += response.isCorrect ? 0 : 1;
                        existing.totalTimeTaken += response.timeTaken;
                        existing.averageTimeTaken = existing.totalTimeTaken / existing.totalQuizzes;
                        existing.accuracy = (existing.correctAnswers / existing.totalQuizzes) * 100;
                        existing.score += response.isCorrect ? 100 : 0;
                        existing.sessionsParticipated.add(session.id);
                    } else {
                        const sessionsSet = new Set<number>();
                        sessionsSet.add(session.id);
                        leaderboardMap.set(userId, {
                            userId,
                            userName: response.user.name,
                            userEmail: response.user.email,
                            totalQuizzes: 1,
                            correctAnswers: response.isCorrect ? 1 : 0,
                            incorrectAnswers: response.isCorrect ? 0 : 1,
                            totalTimeTaken: response.timeTaken,
                            averageTimeTaken: response.timeTaken,
                            accuracy: response.isCorrect ? 100 : 0,
                            score: response.isCorrect ? 100 : 0,
                            sessionsParticipated: sessionsSet,
                        });
                    }
                });
            });
        });

        // Convert to array and sort by score (descending), then by average time (ascending)
        let leaderboard = Array.from(leaderboardMap.values())
            .map((entry) => ({
                ...entry,
                sessionsParticipated: entry.sessionsParticipated.size,
            }))
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return a.averageTimeTaken - b.averageTimeTaken;
            });

        // Add rank
        leaderboard = leaderboard.map((entry, index) => ({
            ...entry,
            rank: index + 1,
        }));

        // Pagination
        const skip = (pageNumber - 1) * pageSize;
        const paginatedLeaderboard = leaderboard.slice(skip, skip + pageSize);

        // Collect all quizzes with their details
        const allQuizzes: any[] = [];
        sessions.forEach((session) => {
            session.sisyaClassQuizzes.forEach((quiz) => {
                const totalResponses = quiz.responses.length;
                const correctResponses = quiz.responses.filter((r) => r.isCorrect).length;
                allQuizzes.push({
                    id: quiz.id,
                    quizId: quiz.quizId,
                    sessionId: session.id,
                    sessionDetail: session.detail,
                    title: quiz.title,
                    type: quiz.type,
                    question: quiz.question,
                    correctAnswer: quiz.correctAnswer,
                    options: quiz.options,
                    timerDuration: quiz.timerDuration,
                    createdAt: quiz.createdAt,
                    endedAt: quiz.endedAt,
                    statistics: {
                        totalResponses,
                        correctResponses,
                        incorrectResponses: totalResponses - correctResponses,
                        accuracy: totalResponses > 0 ? (correctResponses / totalResponses) * 100 : 0,
                    },
                });
            });
        });

        return res.json({
            success: true,
            data: {
                course: course,
                totalSessions: sessions.length,
                quizzes: {
                    total: allQuizzes.length,
                    details: allQuizzes,
                },
                leaderboard: paginatedLeaderboard,
                pagination: {
                    total: leaderboard.length,
                    page: pageNumber,
                    limit: pageSize,
                    totalPages: Math.ceil(leaderboard.length / pageSize),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching course leaderboard:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}
