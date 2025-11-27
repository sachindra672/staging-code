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

        res.json({ success: true, data: updatedSubscription });
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}