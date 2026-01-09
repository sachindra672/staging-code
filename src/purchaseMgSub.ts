import { Request, Response } from "express"
import { prisma } from "./misc"
import { addStudentToGroup } from "./courseGroupChat"


export async function createMgSubscription(req: Request, res: Response) {
    const {
        PurchasePrice,
        cgst,
        sgst,
        basePrice,
        discount,
        endUsersId,
        bigCourseId,
        isPartialPaid,
        OrderId,
        dueDate
    } = req.body

    if (!PurchasePrice || !cgst || !sgst || !basePrice || !endUsersId || !bigCourseId || !OrderId) {
        console.log(req.body)
        return res.status(400).json({
            success: false,
            error: "Missing required fields"
        })
    }

    const numFields = { PurchasePrice, cgst, sgst, basePrice, discount, endUsersId, bigCourseId }
    for (const [key, value] of Object.entries(numFields)) {
        if (isNaN(Number(value))) {
            console.log(key, value, "missing")
            return res.status(400).json({
                success: false,
                error: `Invalid ${key}: must be a number`
            })
        }
    }

    let finalIsFullPaid = true;
    let finalDueDate = dueDate;

    if (isPartialPaid) {
        finalIsFullPaid = false;
        // If dueDate is not provided, set it to 1 month from today
        if (!dueDate) {
            const oneMonthLater = new Date();
            oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
            finalDueDate = oneMonthLater.toISOString(); // convert to string if needed
        }
    }


    try {
        console.log("sub purchased by end user ", endUsersId)
        const newSubscription = await prisma.mgSubsciption.create({
            data: {
                PurchasePrice: Number(PurchasePrice),
                cgst: Number(cgst),
                sgst: Number(sgst),
                basePrice: Number(basePrice),
                discount: discount ? Number(discount) : 0,
                endUsersId: Number(endUsersId),
                bigCourseId: Number(bigCourseId),
                OrderId,
                isPartialPaid,
                isFullPaid: finalIsFullPaid,
                dueDate: finalDueDate,
            }
        })

        // Handle monthly doubt benefit for enrolled students
        try {
            // Find or create doubtRecord for the user
            let doubtRecord = await prisma.doubtRecord.findFirst({
                where: { endUsersId: Number(endUsersId) }
            });

            if (!doubtRecord) {
                // Create new doubtRecord if it doesn't exist
                doubtRecord = await prisma.doubtRecord.create({
                    data: {
                        endUsersId: Number(endUsersId),
                        doubtsAsked: 0,
                        doubtsRemaining: 5, // Default purchased doubts
                        monthlyDoubtsRemaining: 0,
                        monthlyDoubtAllowance: 15,
                        isMonthlyBenefitActive: false,
                    }
                });
            }

            // Check if user already has a linked subscription
            let shouldUpdate = true;
            if (doubtRecord.linkedSubscriptionId !== null) {
                // Check if existing linked subscription is more recent
                const existingSubscription = await prisma.mgSubsciption.findUnique({
                    where: { id: doubtRecord.linkedSubscriptionId }
                });

                if (existingSubscription && existingSubscription.createdAt > newSubscription.createdAt) {
                    // Existing subscription is more recent, don't replace
                    shouldUpdate = false;
                }
            }

            if (shouldUpdate) {
                // Get current purchased doubts to preserve them
                const currentPurchasedDoubts = doubtRecord.doubtsRemaining || 5;

                // Link doubtRecord to new subscription and set monthly benefit
                await prisma.doubtRecord.update({
                    where: { id: doubtRecord.id },
                    data: {
                        linkedSubscriptionId: newSubscription.id,
                        enrollmentDate: newSubscription.createdAt,
                        lastMonthlyResetDate: newSubscription.createdAt, // First reset will be 30 days from this
                        isMonthlyBenefitActive: true,
                        monthlyDoubtsRemaining: 15, // Set monthly benefit to 15
                        monthlyDoubtAllowance: 15,
                        doubtsRemaining: currentPurchasedDoubts, // Preserve purchased doubts
                    }
                });
            }
        } catch (doubtError) {
            // Log error but don't fail subscription creation
            console.error("Error setting up monthly doubt benefit:", doubtError);
        }

        // await addStudentToGroup(Number(endUsersId), Number(bigCourseId));
        const existingGroup = await prisma.groupChat.findFirst({
            where: {
                bigCourseId: Number(bigCourseId),
                isActive: true,
            }
        });

        if (existingGroup) {
            await addStudentToGroup(Number(endUsersId), Number(bigCourseId));
        }

        res.status(201).json({
            success: true,
            data: newSubscription
        })
    } catch (error) {
        console.error("Error creating mgSubscription:", error)
        if (error === 'P2003') {
            return res.status(400).json({
                success: false,
                error: "Invalid endUsersId or bigCourseId"
            })
        }
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
}

export async function updateMgSubscriptionDueDate(req: Request, res: Response) {
    const { endUsersId, bigCourseId, dueDate } = req.body;

    if (!endUsersId || !bigCourseId || !dueDate) {
        return res.status(400).json({
            success: false,
            error: 'endUsersId, bigCourseId, and dueDate are required',
        });
    }

    try {
        const subscription = await prisma.mgSubsciption.findFirst({
            where: {
                endUsersId: Number(endUsersId),
                bigCourseId: Number(bigCourseId),
            },
        });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found for the given user and course',
            });
        }

        const updatedSubscription = await prisma.mgSubsciption.update({
            where: { id: subscription.id },
            data: { dueDate: new Date(dueDate) },
        });

        return res.status(200).json({
            success: true,
            data: updatedSubscription,
        });
    } catch (error) {
        console.error('Error updating dueDate:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

export async function getMgSubscriptionsByUserId(req: Request, res: Response) {
    const { endUsersId } = req.body

    if (!endUsersId || isNaN(Number(endUsersId))) {
        return res.status(400).json({
            success: false,
            error: "Invalid or missing endUsersId"
        })
    }

    try {
        const subscriptions = await prisma.mgSubsciption.findMany({
            where: {
                endUsersId: Number(endUsersId),
                isActive: true
            },
            include: {
                course: true // Include related course data
            }
        })

        if (subscriptions.length === 0) {
            return res.status(404).json({
                success: false,
                error: "No subscriptions found for this user"
            })
        }

        res.status(200).json({
            success: true,
            data: subscriptions
        })
    } catch (error) {
        console.error("Error retrieving mgSubscriptions:", error)
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
}

export async function getMgSubscriptionsByUserId2(req: Request, res: Response) {
    const { endUsersId } = req.body

    if (!endUsersId || isNaN(Number(endUsersId))) {
        return res.status(400).json({
            success: false,
            error: "Invalid or missing endUsersId"
        })
    }

    try {
        const subscriptions = await prisma.mgSubsciption.findMany({
            where: {
                endUsersId: Number(endUsersId),
            },
            include: {
                course: true // Include related course data
            }
        })

        if (subscriptions.length === 0) {
            return res.status(404).json({
                success: false,
                error: "No subscriptions found for this user"
            })
        }

        res.status(200).json({
            success: true,
            data: subscriptions
        })
    } catch (error) {
        console.error("Error retrieving mgSubscriptions:", error)
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
}

export async function getMgSubscriptionsByUserId3(req: Request, res: Response) {
    const { endUsersId } = req.body

    if (!endUsersId || isNaN(Number(endUsersId))) {
        return res.status(400).json({
            success: false,
            error: "Invalid or missing endUsersId"
        })
    }

    try {
        const subscriptions = await prisma.mgSubsciption.findMany({
            where: {
                endUsersId: Number(endUsersId),
            },
            include: {
                course: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        level: true,
                        price: true,
                        currentPrice: true,
                        isLongTerm: true,
                        isFree: true,
                        startDate: true,
                        endDate: true,
                        averageRating: true,
                        isActive: true,
                        grade: true,
                        partialPrice: true,
                    },
                },
            },
        });


        if (subscriptions.length === 0) {
            return res.status(404).json({
                success: false,
                error: "No subscriptions found for this user"
            })
        }

        res.status(200).json({
            success: true,
            data: subscriptions
        })
    } catch (error) {
        console.error("Error retrieving mgSubscriptions:", error)
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
}

export async function markMgSubscriptionAsFullyPaid(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId) {
        return res.status(400).json({
            success: false,
            error: 'endUsersId and bigCourseId are required',
        });
    }

    try {
        const subscription = await prisma.mgSubsciption.findFirst({
            where: {
                endUsersId: Number(endUsersId),
                bigCourseId: Number(bigCourseId),
            },
        });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found for the given user and course',
            });
        }

        const updatedSubscription = await prisma.mgSubsciption.update({
            where: { id: subscription.id },
            data: {
                isFullPaid: true,
                isPartialPaid: false,
                dueDate: null,
            },
        });

        return res.status(200).json({
            success: true,
            data: updatedSubscription,
        });
    } catch (error) {
        console.error('Error marking full payment:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

export async function getMgSubscriptions(_: Request, res: Response) {
    try {
        const subs = await prisma.mgSubsciption.findMany({ include: { course: { select: { isLongTerm: true, grade: true, name: true } }, user: { select: { name: true } } }, })
        res.json({ success: true, subs })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error })
    }
}

export async function getMgSubscriptionsByStudent(req: Request, res: Response) {
    const { endUsersId } = req.body
    try {
        const subs = await prisma.mgSubsciption.findMany({ where: { endUsersId }, include: { course: { select: { isLongTerm: true, grade: true, name: true } }, user: { select: { name: true } } }, })
        res.json({ success: true, subs })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error })
    }
}

export async function MgSubtoggleIsActive(req: Request, res: Response) {
    const { id, isActive } = req.body;

    if (!id || typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, error: 'Invalid request data' });
    }

    try {
        const updatedSubscription = await prisma.mgSubsciption.update({
            where: { id: Number(id) },
            data: { isActive }
        });

        // Handle monthly doubt benefit deactivation
        if (!isActive) {
            // Subscription is being deactivated
            try {
                const doubtRecord = await prisma.doubtRecord.findFirst({
                    where: { linkedSubscriptionId: Number(id) }
                });

                if (doubtRecord) {
                    // Deactivate monthly benefit but preserve doubts
                    await prisma.doubtRecord.update({
                        where: { id: doubtRecord.id },
                        data: {
                            isMonthlyBenefitActive: false,
                            // Keep monthlyDoubtsRemaining and doubtsRemaining as is
                            // Don't remove doubts, just deactivate benefit
                        }
                    });
                }
            } catch (doubtError) {
                // Log error but don't fail subscription update
                console.error("Error deactivating monthly doubt benefit:", doubtError);
            }
        } else {
            // Subscription is being reactivated
            try {
                const doubtRecord = await prisma.doubtRecord.findFirst({
                    where: { linkedSubscriptionId: Number(id) }
                });

                if (doubtRecord) {
                    // Reactivate monthly benefit and reset monthly doubts
                    await prisma.doubtRecord.update({
                        where: { id: doubtRecord.id },
                        data: {
                            isMonthlyBenefitActive: true,
                            monthlyDoubtsRemaining: 15, // Reset to 15 on reactivation
                            lastMonthlyResetDate: new Date(), // Reset timer
                            enrollmentDate: updatedSubscription.createdAt, // Update enrollment date
                        }
                    });
                }
            } catch (doubtError) {
                // Log error but don't fail subscription update
                console.error("Error reactivating monthly doubt benefit:", doubtError);
            }
        }

        res.json({ success: true, data: updatedSubscription });
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}