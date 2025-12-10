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

// // POST: End quiz and save all responses (bulk save)
// export async function endQuiz(req: Request, res: Response) {
//     try {
//         const {
//             quizId,
//             responses, // Array of responses from frontend
//         } = req.body;

//         if (!quizId) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Quiz ID is required",
//             });
//         }

//         // Find quiz
//         const quiz = await prisma.sisyaClassQuiz.findFirst({
//             where: {
//                 OR: [
//                     { id: Number(quizId) },
//                     { quizId: String(quizId) },
//                 ],
//             },
//         });

//         if (!quiz) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Quiz not found",
//             });
//         }

//         // Update quiz to inactive and set endedAt
//         await prisma.sisyaClassQuiz.update({
//             where: { id: quiz.id },
//             data: {
//                 isActive: false,
//                 endedAt: new Date(),
//             },
//         });

//         // If responses array is provided, save them in bulk
//         if (responses && Array.isArray(responses) && responses.length > 0) {
//             // Prepare response data
//             const responseData = responses.map((r: any) => {
//                 const isCorrect = r.selectedAnswer?.toLowerCase() === quiz.correctAnswer.toLowerCase();
//                 return {
//                     quizId: quiz.id,
//                     userId: Number(r.userId),
//                     selectedAnswer: String(r.selectedAnswer),
//                     timeTaken: Number(r.timeTaken || 0),
//                     isCorrect,
//                 };
//             });

//             // Bulk create responses (skip duplicates)
//             await prisma.sisyaClassQuizResponse.createMany({
//                 data: responseData,
//                 skipDuplicates: true,
//             });
//         }

//         // Get updated quiz with all responses
//         const updatedQuiz = await prisma.sisyaClassQuiz.findUnique({
//             where: { id: quiz.id },
//             include: {
//                 responses: {
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 email: true,
//                             },
//                         },
//                     },
//                     orderBy: [
//                         { isCorrect: "desc" },
//                         { timeTaken: "asc" },
//                     ],
//                 },
//             },
//         });

//         // Calculate top 3 performers
//         const topPerformers = updatedQuiz?.responses
//             .filter((r) => r.isCorrect)
//             .sort((a, b) => a.timeTaken - b.timeTaken)
//             .slice(0, 3)
//             .map((r) => ({
//                 userId: r.userId,
//                 userName: r.user.name,
//                 timeTaken: r.timeTaken,
//                 selectedAnswer: r.selectedAnswer,
//             })) || [];

//         return res.json({
//             success: true,
//             message: "Quiz ended successfully",
//             data: {
//                 quiz: updatedQuiz,
//                 topPerformers,
//             },
//         });
//     } catch (error: any) {
//         console.error("Error ending quiz:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//         });
//     }
// }

// export async function endQuiz(req: Request, res: Response) {
//     try {
//         const {
//             quizId,
//             responses,
//         } = req.body;

//         if (!quizId) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Quiz ID is required",
//             });
//         }

//         // Build OR conditions - only include numeric ID if quizId is actually a number
//         const orConditions: any[] = [
//             { quizId: String(quizId) },
//         ];

//         // Only add numeric ID condition if quizId can be converted to a valid number
//         const numericId = Number(quizId);
//         if (!isNaN(numericId) && isFinite(numericId)) {
//             orConditions.unshift({ id: numericId });
//         }

//         // Find quiz
//         const quiz = await prisma.sisyaClassQuiz.findFirst({
//             where: {
//                 OR: orConditions,
//             },
//         });

//         if (!quiz) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Quiz not found",
//             });
//         }

//         // Update quiz to inactive and set endedAt
//         await prisma.sisyaClassQuiz.update({
//             where: { id: quiz.id },
//             data: {
//                 isActive: false,
//                 endedAt: new Date(),
//             },
//         });

//         // If responses array is provided, save them in bulk
//         if (responses && Array.isArray(responses) && responses.length > 0) {
//             // Prepare response data with validation
//             const responseData = responses
//                 .map((r: any) => {
//                     // Validate userId
//                     const userId = Number(r.userId);
//                     if (isNaN(userId) || !isFinite(userId)) {
//                         return null; // Skip invalid userIds
//                     }

//                     const isCorrect = r.selectedAnswer?.toLowerCase() === quiz.correctAnswer.toLowerCase();

//                     return {
//                         quizId: quiz.id,
//                         userId: userId,
//                         selectedAnswer: String(r.selectedAnswer || ''),
//                         timeTaken: Number(r.timeTaken || 0),
//                         isCorrect,
//                     };
//                 })
//                 .filter((r: any) => r !== null); // Remove invalid entries

//             // Bulk create responses (skip duplicates)
//             if (responseData.length > 0) {
//                 await prisma.sisyaClassQuizResponse.createMany({
//                     data: responseData,
//                     skipDuplicates: true,
//                 });
//             }
//         }

//         // Get updated quiz with all responses
//         const updatedQuiz = await prisma.sisyaClassQuiz.findUnique({
//             where: { id: quiz.id },
//             include: {
//                 responses: {
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 email: true,
//                             },
//                         },
//                     },
//                     orderBy: [
//                         { isCorrect: "desc" },
//                         { timeTaken: "asc" },
//                     ],
//                 },
//             },
//         });

//         // Calculate top 3 performers
//         const correctResponses = updatedQuiz?.responses
//             .filter((r) => r.isCorrect)
//             .sort((a, b) => a.timeTaken - b.timeTaken) || [];

//         const topPerformers = correctResponses
//             .slice(0, 3)
//             .map((r) => ({
//                 userId: r.userId,
//                 userName: r.user.name,
//                 timeTaken: r.timeTaken,
//                 selectedAnswer: r.selectedAnswer,
//             }));

//         // Grant rewards to all participants
//         const rewardResults: any[] = [];
//         const baseReward = 10; // 10 coins for all participants who answered correctly
//         const bonuses = [10, 5, 3]; // Bonuses for 1st, 2nd, 3rd place

//         // Check system wallet balance first
//         const systemWallet = await getSystemWallet();
//         const totalParticipants = correctResponses.length;
//         const totalCoinsNeeded = (baseReward * totalParticipants) +
//             (topPerformers.length > 0 ? bonuses[0] : 0) +
//             (topPerformers.length > 1 ? bonuses[1] : 0) +
//             (topPerformers.length > 2 ? bonuses[2] : 0);

//         const totalCoinsNeededDecimal = new Decimal(totalCoinsNeeded);

//         if (systemWallet.spendableBalance.lt(totalCoinsNeededDecimal)) {
//             console.warn(`System wallet has insufficient balance for quiz rewards. Available: ${systemWallet.spendableBalance}, Required: ${totalCoinsNeeded}`);
//         } else {
//             // Grant rewards to all participants who answered correctly
//             for (let i = 0; i < correctResponses.length; i++) {
//                 const response = correctResponses[i];
//                 const isTopPerformer = i < 3;
//                 const position = i + 1;

//                 let coinsAmount = baseReward;
//                 let reasonParts = [`Base participation reward: ${baseReward} coins`];

//                 // Add position bonus
//                 if (isTopPerformer) {
//                     const bonus = bonuses[i];
//                     coinsAmount += bonus;
//                     reasonParts.push(`Position ${position} bonus: +${bonus} coins`);
//                 }

//                 const taskCode = `QUIZ_${quiz.id}_${response.userId}`;
//                 const amountDecimal = new Decimal(coinsAmount);
//                 const reason = `Quiz participation - ${reasonParts.join(', ')}`;

//                 try {
//                     // Check if we still have enough balance
//                     if (systemWallet.spendableBalance.lt(amountDecimal)) {
//                         console.warn(`System wallet balance insufficient for user ${response.userId}. Skipping reward.`);
//                         rewardResults.push({
//                             userId: response.userId,
//                             userName: response.user.name,
//                             success: false,
//                             message: "Insufficient system wallet balance",
//                             coinsEarned: 0,
//                         });
//                         continue;
//                     }

//                     const rewardReq = {
//                         body: {
//                             userId: response.userId,
//                             taskCode: taskCode,
//                             coinsAmount: coinsAmount,
//                             reason: reason,
//                             metadata: {
//                                 quizId: quiz.id,
//                                 quizTitle: quiz.title,
//                                 position: isTopPerformer ? position : null,
//                                 isCorrect: true,
//                                 timeTaken: response.timeTaken,
//                             }
//                         }
//                     } as Request;

//                     let rewardResponseData: any = null;
//                     const rewardRes = {
//                         json: (data: any) => {
//                             rewardResponseData = data;
//                         },
//                         status: (_code: number) => ({
//                             json: (data: any) => {
//                                 rewardResponseData = data;
//                             }
//                         })
//                     } as unknown as Response;

//                     await grantTaskReward(rewardReq, rewardRes);

//                     if (rewardResponseData?.success) {
//                         rewardResults.push({
//                             userId: response.userId,
//                             userName: response.user.name,
//                             success: true,
//                             coinsEarned: coinsAmount,
//                             message: reasonParts.join(', '),
//                             position: isTopPerformer ? position : null,
//                             userWallet: rewardResponseData.data?.userWallet || null,
//                         });
//                     } else {
//                         rewardResults.push({
//                             userId: response.userId,
//                             userName: response.user.name,
//                             success: false,
//                             message: rewardResponseData?.message || "Reward grant failed",
//                             coinsEarned: 0,
//                         });
//                     }
//                 } catch (rewardError) {
//                     console.error(`Error granting reward to user ${response.userId}:`, rewardError);
//                     rewardResults.push({
//                         userId: response.userId,
//                         userName: response.user.name,
//                         success: false,
//                         message: "Error processing reward",
//                         error: rewardError instanceof Error ? rewardError.message : "Unknown error",
//                         coinsEarned: 0,
//                     });
//                 }
//             }
//         }

//         return res.json({
//             success: true,
//             message: "Quiz ended successfully",
//             data: {
//                 quiz: updatedQuiz,
//                 topPerformers,
//                 rewards: {
//                     totalParticipants: totalParticipants,
//                     totalCoinsDistributed: rewardResults
//                         .filter(r => r.success)
//                         .reduce((sum, r) => sum + (r.coinsEarned || 0), 0),
//                     results: rewardResults,
//                 },
//             },
//         });
//     } catch (error: any) {
//         console.error("Error ending quiz:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//         });
//     }
// }
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


