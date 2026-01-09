import { Request, Response } from "express";
import { prisma } from "./misc";
import fs from 'fs';
import path from 'path';
import { sendMail } from "./utils/mail";


export async function insertDoubt(req: Request, res: Response) {
    const { subject, description, topic, userId, subjectRecord, files, mentorId, conversationId } = req.body;


    if (!subject || !description || !topic || !userId || !subjectRecord || !mentorId) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const doubt = await prisma.doubt.create({
            data: {
                subject,
                userId,
                description,
                topic,
                mentorId,
                conversationId,
                status: 0,
                subjectRecord: {
                    create: subjectRecord
                }
            }
        });

        const doubtDir = path.join(__dirname, `../doubts/${doubt.id}`);
        if (!fs.existsSync(doubtDir)) {
            fs.mkdirSync(doubtDir, { recursive: true });
        }

        if (files && Array.isArray(files)) {
            files.forEach((file) => {
                const { filename, content } = file;
                const filePath = path.join(doubtDir, filename);
                const fileContent = Buffer.from(content, 'base64');

                //@ts-ignore
                fs.writeFileSync(filePath, fileContent);
            });
        }

        const teacherList = (await prisma.subjectRecord.findMany({
            where: { id: subjectRecord.subjectId, mentorId: { not: null } },
            include: { mentor: true }
        })).map(e => e.mentor);

        res.status(201).json({ success: true, doubt, teacherList });
    } catch (error) {
        console.error('Error in insertDoubt:', error);
        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

function doubtCreatedEmailTemplate(teacherName: string, subject: string, topic: string, description: string, doubtId: number, slotInfo: string = '') {
    return `
    <div style="font-family: Arial, sans-serif; background:#f5f7fa; padding:20px;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            
            <div style="background:#1a73e8; padding:20px; text-align:center;">
                <img src="https://storage.googleapis.com/sisya-class-52660.appspot.com/globalMaterialUpload/12/Logo/-QAybKnHXpRnTHfDmm5vK-1764075707714.png" 
                     alt="Sisya Logo" style="height:60px; border-radius:10px;">
            </div>

            <div style="padding:25px;">
                <h2 style="color:#1a1a1a;">New Doubt Assigned</h2>

                <p style="font-size:15px; color:#333;">
                    Hello <strong>${teacherName || "Teacher"}</strong>,
                </p>

                <p style="font-size:15px; color:#333;">
                    A new student doubt has been assigned to you on the SISYA platform.
                </p>

                <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-top:15px;">
                    <p style="margin:0; font-size:14px;"><strong>Subject:</strong> ${subject}</p>
                    <p style="margin:0; font-size:14px;"><strong>Topic:</strong> ${topic}</p>
                    <p style="margin:0; font-size:14px;"><strong>Description:</strong> ${description}</p>
                    <p style="margin:0; font-size:14px;"><strong>Doubt ID:</strong> ${doubtId}</p>
                    ${slotInfo}
                </div>

                <div style="text-align:center; margin-top:25px;">
                    <a href="https://doubt-dashboard.vercel.app/"
                       style="background:#1a73e8; color:white; padding:12px 22px; border-radius:6px; text-decoration:none; font-size:15px;">
                        View Doubt
                    </a>
                </div>

                <p style="margin-top:25px; font-size:13px; color:#777;">
                    Please log in to your SISYA teacher doubt dashboard to respond to the student.
                </p>
            </div>

            <div style="text-align:center; background:#f1f1f1; padding:15px; font-size:12px; color:#666;">
                © ${new Date().getFullYear()} SISYA Learning. All rights reserved.
            </div>

        </div>
    </div>`;
}

export async function insertDoubt2(req: Request, res: Response) {
    const { subject, description, topic, userId, subjectRecord, files, mentorId, conversationId } = req.body;

    if (!subject || !description || !topic || !userId || !subjectRecord || !mentorId) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check user's doubt balance (monthly + purchased)
    try {
        const doubtRecord = await prisma.doubtRecord.findFirst({
            where: { endUsersId: userId }
        });

        if (!doubtRecord) {
            return res.status(404).json({
                success: false,
                error: 'Doubt record not found for user'
            });
        }

        // Calculate total available doubts (monthly + purchased)
        const monthlyDoubts = doubtRecord.monthlyDoubtsRemaining || 0;
        const purchasedDoubts = doubtRecord.doubtsRemaining || 0;
        const totalAvailable = monthlyDoubts + purchasedDoubts;

        if (totalAvailable <= 0) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient doubt balance',
                message: 'You have no doubts remaining. Please purchase a doubt package to continue.',
                doubtsRemaining: purchasedDoubts,
                monthlyDoubtsRemaining: monthlyDoubts,
                totalAvailable: 0
            });
        }
    } catch (error) {
        console.error('Error checking doubt balance:', error);
        return res.status(500).json({
            success: false,
            error: 'Error checking doubt balance'
        });
    }

    try {
        // Create doubt and decrement balance in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create the doubt
            const doubt = await tx.doubt.create({
                data: {
                    subject,
                    userId,
                    description,
                    topic,
                    mentorId,
                    conversationId,
                    status: 0,
                    subjectRecord: {
                        create: subjectRecord
                    }
                }
            });

            // Update doubt record - increment doubtsAsked and decrement doubtsRemaining
            await tx.doubtRecord.updateMany({
                where: { endUsersId: userId },
                data: {
                    doubtsAsked: { increment: 1 },
                    doubtsRemaining: { decrement: 1 }
                }
            });

            return doubt;
        });

        const doubtDir = path.join(__dirname, `../doubts/${result.id}`);
        if (!fs.existsSync(doubtDir)) {
            fs.mkdirSync(doubtDir, { recursive: true });
        }

        if (files && Array.isArray(files)) {
            files.forEach((file) => {
                const { filename, content } = file;
                const filePath = path.join(doubtDir, filename);
                const fileContent = Buffer.from(content, 'base64');

                //@ts-ignore
                fs.writeFileSync(filePath, fileContent);
            });
        }

        const mentor = await prisma.mentor.findUnique({
            where: { id: mentorId }
        });

        if (mentor && mentor.email) {
            const html = doubtCreatedEmailTemplate(
                mentor.name,
                subject,
                topic,
                description,
                result.id
            );

            await sendMail(
                mentor.email,
                `New Student Doubt Assigned - ${subject}`,
                html
            );
        }

        // Get updated balance
        const updatedRecord = await prisma.doubtRecord.findFirst({
            where: { endUsersId: userId }
        });

        const monthlyDoubts = updatedRecord?.monthlyDoubtsRemaining || 0;
        const purchasedDoubts = updatedRecord?.doubtsRemaining || 0;
        const totalAvailable = monthlyDoubts + purchasedDoubts;

        res.status(201).json({
            success: true,
            doubt: result,
            doubtsRemaining: purchasedDoubts,
            monthlyDoubtsRemaining: monthlyDoubts,
            totalAvailable: totalAvailable
        });

    } catch (error) {
        console.error('Error in insertDoubt:', error);
        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

/**
 * Create doubt with slot booking integration
 * This version includes checking mentor's available slots and booking one automatically
 */
export async function insertDoubt3(req: Request, res: Response) {
    const { subject, description, topic, userId, subjectRecord, files, mentorId, conversationId, slotId } = req.body;

    if (!subject || !description || !topic || !userId || !subjectRecord || !mentorId) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check user's doubt balance (monthly + purchased)
    try {
        const doubtRecord = await prisma.doubtRecord.findFirst({
            where: { endUsersId: userId }
        });

        if (!doubtRecord) {
            return res.status(404).json({
                success: false,
                error: 'Doubt record not found for user'
            });
        }

        // Calculate total available doubts (monthly + purchased)
        const monthlyDoubts = doubtRecord.monthlyDoubtsRemaining || 0;
        const purchasedDoubts = doubtRecord.doubtsRemaining || 0;
        const totalAvailable = monthlyDoubts + purchasedDoubts;

        if (totalAvailable <= 0) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient doubt balance',
                message: 'You have no doubts remaining. Please purchase a doubt package to continue.',
                doubtsRemaining: purchasedDoubts,
                monthlyDoubtsRemaining: monthlyDoubts,
                totalAvailable: 0
            });
        }
    } catch (error) {
        console.error('Error checking doubt balance:', error);
        return res.status(500).json({
            success: false,
            error: 'Error checking doubt balance'
        });
    }

    try {
        // If slotId is provided, validate it exists and is available
        if (slotId) {
            const slot = await prisma.doubtSlot.findUnique({
                where: { id: slotId }
            });

            if (!slot) {
                return res.status(404).json({
                    success: false,
                    error: 'Slot not found'
                });
            }

            if (!slot.isAvailable || slot.currentBookings >= slot.maxCapacity) {
                return res.status(400).json({
                    success: false,
                    error: 'Selected slot is not available for booking',
                    slotId
                });
            }
        }

        // Create doubt and decrement balance in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create the doubt
            const doubt = await tx.doubt.create({
                data: {
                    subject,
                    userId,
                    description,
                    topic,
                    mentorId,
                    conversationId,
                    status: 0,
                    subjectRecord: {
                        create: subjectRecord
                    }
                }
            });

            // Update doubt record - increment doubtsAsked and decrement doubts
            // Priority: Use monthlyDoubtsRemaining first, then doubtsRemaining (purchased)
            const currentRecord = await tx.doubtRecord.findFirst({
                where: { endUsersId: userId },
                select: { monthlyDoubtsRemaining: true, doubtsRemaining: true }
            });

            const updateData: any = {
                doubtsAsked: { increment: 1 }
            };

            // Use monthly doubts first, then purchased doubts
            if (currentRecord && (currentRecord.monthlyDoubtsRemaining || 0) > 0) {
                updateData.monthlyDoubtsRemaining = { decrement: 1 };
            } else {
                updateData.doubtsRemaining = { decrement: 1 };
            }

            await tx.doubtRecord.updateMany({
                where: { endUsersId: userId },
                data: updateData
            });

            // Book a slot if slotId is provided
            if (slotId) {
                await tx.doubtSlotBooking.create({
                    data: {
                        slotId,
                        doubtId: doubt.id,
                        mentorId,
                        studentId: userId,
                        status: 'scheduled'
                    }
                });

                // Update slot bookings count
                await tx.doubtSlot.update({
                    where: { id: slotId },
                    data: { currentBookings: { increment: 1 } }
                });
            }

            return { doubt, slotBooked: slotId ? true : false };
        });

        const doubtDir = path.join(__dirname, `../doubts/${result.doubt.id}`);
        if (!fs.existsSync(doubtDir)) {
            fs.mkdirSync(doubtDir, { recursive: true });
        }

        if (files && Array.isArray(files)) {
            files.forEach((file) => {
                const { filename, content } = file;
                const filePath = path.join(doubtDir, filename);
                const fileContent = Buffer.from(content, 'base64');

                //@ts-ignore
                fs.writeFileSync(filePath, fileContent);
            });
        }

        const mentor = await prisma.mentor.findUnique({
            where: { id: mentorId }
        });

        if (mentor && mentor.email) {
            const slotInfo = slotId ? `\n<p><strong>Scheduled Slot ID:</strong> ${slotId}</p>` : '';
            const html = doubtCreatedEmailTemplate(
                mentor.name,
                subject,
                topic,
                description,
                result.doubt.id,
                slotInfo
            );

            await sendMail(
                mentor.email,
                `New Student Doubt Assigned - ${subject}`,
                html
            );
        }

        // Get updated balance
        const updatedRecord = await prisma.doubtRecord.findFirst({
            where: { endUsersId: userId }
        });

        const monthlyDoubts = updatedRecord?.monthlyDoubtsRemaining || 0;
        const purchasedDoubts = updatedRecord?.doubtsRemaining || 0;
        const totalAvailable = monthlyDoubts + purchasedDoubts;

        res.status(201).json({
            success: true,
            doubt: result.doubt,
            slotBooked: result.slotBooked,
            slotId: slotId || null,
            doubtsRemaining: purchasedDoubts,
            monthlyDoubtsRemaining: monthlyDoubts,
            totalAvailable: totalAvailable,
            message: result.slotBooked ? 'Doubt created and slot booked successfully' : 'Doubt created successfully'
        });

    } catch (error) {
        console.error('Error in insertDoubt3:', error);
        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}


export async function AssignMentor(req: Request, res: Response) {
    const { mentorId, doubtId } = req.body

    try {
        const doubt = await prisma.doubt.update({ where: { id: doubtId }, data: { mentorId } })
        res.status(200).json({ success: true, doubt })
    } catch (error) {
        console.error('Error in insertDoubt:', error);
        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

export async function updateDoubt(req: Request, res: Response) {
    const { id, subject, description, topic, userId, status } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: 'Missing doubt id' });
    }

    try {
        const doubt = await prisma.doubt.update({
            where: { id },
            data: { subject, userId, description, topic, status }
        });
        res.status(200).json({ success: true, doubt });
    } catch (error) {
        console.error('Error in updateDoubt:', error);
        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

export async function insertDoubtResponse(req: Request, res: Response) {
    const { response, doubtId, mentorId } = req.body;

    if (!response || !doubtId || !mentorId) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const doubtResponse = await prisma.doubtResponse.create({
            data: { response, doubtId, mentorId }
        });
        res.status(201).json({ success: true, doubtResponse });
    } catch (error) {
        console.error('Error in insertDoubtResponse:', error);
        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

export async function updateDoubtResponse(req: Request, res: Response) {
    const { id, response } = req.body;

    if (!id || !response) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const updatedResponse = await prisma.doubtResponse.update({
            where: { id },
            data: { response }
        });
        res.status(200).json({ success: true, updatedResponse });
    } catch (error) {
        console.error('Error in updateDoubtResponse:', error);
        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

export async function getMyDoubts(req: Request, res: Response) {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    try {
        const doubts = await prisma.doubt.findMany({
            where: { userId },
            include: {
                doubtResponse: true,
                slotBooking: {
                    include: {
                        slot: true,
                        mentor: true
                    }
                }
            }
        });
        res.status(200).json({ success: true, doubts });
    } catch (error) {
        console.error('Error in getMyDoubts:', error);
        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

export async function getDoubtFiles(req: Request, res: Response) {
    const { doubtId } = req.body;

    if (!doubtId) {
        return res.status(400).json({ success: false, error: 'Missing doubtId parameter' });
    }
    try {
        const doubtDir = path.join(__dirname, `../doubts/${doubtId}`);

        if (!fs.existsSync(doubtDir)) {
            return res.status(404).json({ success: false, error: 'Doubt not found or no files uploaded' });
        }
        const files = fs.readdirSync(doubtDir);
        res.status(200).json({ success: true, files });
    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}

export async function getAssignedDoubts(req: Request, res: Response) {
    const { mentorId } = req.body
    if (!mentorId) {
        return res.status(400).json({ success: false, error: 'Missing doubtId parameter' });
    }
    try {
        const doubts = await prisma.doubt.findMany({
            where: { mentorId },
            include: {
                asker: true,
                slotBooking: {
                    include: {
                        slot: true,
                        mentor: true
                    }
                }
            }
        });
        const users = doubts.map(e => e.asker).map(e => { return { ...e, password: null } })
        res.status(200).json({ success: true, users, doubts });
    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}

export async function getAssignedDoubtsList(req: Request, res: Response) {
    const { mentorId } = req.body
    if (!mentorId) {
        return res.status(400).json({ success: false, error: 'Missing doubtId parameter' });
    }
    try {
        const doubts = await prisma.doubt.findMany({
            where: { mentorId },
            include: {
                asker: true,
                slotBooking: {
                    include: {
                        slot: true,
                        mentor: true
                    }
                }
            }
        })
        res.status(200).json({ success: true, doubts });
    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}

export async function GetAllDoubts(_: Request, res: Response) {
    try {
        const doubts = await prisma.doubt.findMany({
            include: {
                slotBooking: {
                    include: {
                        slot: true,
                        mentor: true
                    }
                }
            }
        })
        res.status(200).json({ success: true, doubts });

    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}

// Get user's doubt balance
export async function getDoubtBalance(req: Request, res: Response) {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'Missing userId parameter'
        });
    }

    try {
        const doubtRecord = await prisma.doubtRecord.findFirst({
            where: { endUsersId: userId }
        });

        if (!doubtRecord) {
            return res.status(404).json({
                success: false,
                error: 'Doubt record not found for user'
            });
        }

        const monthlyDoubts = doubtRecord.monthlyDoubtsRemaining || 0;
        const purchasedDoubts = doubtRecord.doubtsRemaining || 0;
        const totalAvailable = monthlyDoubts + purchasedDoubts;

        res.status(200).json({
            success: true,
            data: {
                doubtsAsked: doubtRecord.doubtsAsked,
                doubtsRemaining: purchasedDoubts, // Purchased doubts
                monthlyDoubtsRemaining: monthlyDoubts, // Monthly benefit doubts
                totalAvailable: totalAvailable, // Total available (monthly + purchased)
                totalDoubts: doubtRecord.doubtsAsked + totalAvailable
            }
        });
    } catch (error) {
        console.error('Error in getDoubtBalance:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error
        });
    }
}

// Purchase doubt package
export async function purchaseDoubtPackage(req: Request, res: Response) {
    const { userId, packageId, orderID, source } = req.body;

    if (!userId || !packageId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields (userId, packageId)'
        });
    }

    try {
        // Get the package details
        const doubtPackage = await prisma.doubtPackage.findUnique({
            where: { id: packageId }
        });

        if (!doubtPackage) {
            return res.status(404).json({
                success: false,
                error: 'Doubt package not found'
            });
        }

        if (!doubtPackage.isActive) {
            return res.status(400).json({
                success: false,
                error: 'This doubt package is no longer available'
            });
        }

        const doubtCount = doubtPackage.doubtCount;
        const amountPaid = doubtPackage.discountedPrice || doubtPackage.price;

        // Use transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // Get or create doubt record
            let doubtRecord = await tx.doubtRecord.findFirst({
                where: { endUsersId: userId }
            });

            if (!doubtRecord) {
                // If no record exists, create one
                doubtRecord = await tx.doubtRecord.create({
                    data: {
                        endUsersId: userId,
                        doubtsAsked: 0,
                        doubtsRemaining: doubtCount
                    }
                });
            } else {
                // Update existing record
                doubtRecord = await tx.doubtRecord.update({
                    where: { id: doubtRecord.id },
                    data: {
                        doubtsRemaining: { increment: doubtCount }
                    }
                });
            }

            // Create purchase record
            const purchase = await tx.doubtPackagePurchases.create({
                data: {
                    endUsersId: userId,
                    doubtRecordId: doubtRecord.id,
                    doubtPackageId: packageId,
                    DoubtCount: doubtCount,
                    amountPaid: amountPaid,
                    orderID: orderID || null,
                    source: source || null
                }
            });

            if (source === 'landing_page') {
                await tx.endUsers.update({
                    where: { id: userId },
                    data: {
                        isDoubtPackageFromLP: true
                    }
                })
            }

            return { doubtRecord, purchase, doubtPackage };
        });

        res.status(201).json({
            success: true,
            message: `Successfully purchased ${doubtCount} doubts`,
            data: {
                doubtsRemaining: result.doubtRecord.doubtsRemaining,
                doubtsAsked: result.doubtRecord.doubtsAsked,
                purchase: result.purchase,
                package: {
                    name: result.doubtPackage.name,
                    doubtCount: result.doubtPackage.doubtCount,
                    amountPaid: amountPaid
                }
            }
        });
    } catch (error) {
        console.error('Error in purchaseDoubtPackage:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error
        });
    }
}

// Get user's doubt purchase history
export async function getDoubtPurchaseHistory(req: Request, res: Response) {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'Missing userId parameter'
        });
    }

    try {
        const purchases = await prisma.doubtPackagePurchases.findMany({
            where: { endUsersId: userId },
            orderBy: { createOn: 'desc' },
            include: {
                record: true,
                package: true
            }
        });

        res.status(200).json({
            success: true,
            data: purchases
        });
    } catch (error) {
        console.error('Error in getDoubtPurchaseHistory:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error
        });
    }
}

// Get all active doubt packages
export async function getDoubtPackages(_req: Request, res: Response) {
    try {
        const packages = await prisma.doubtPackage.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
        });

        res.status(200).json({
            success: true,
            data: packages
        });
    } catch (error) {
        console.error('Error in getDoubtPackages:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error
        });
    }
}

// Create doubt package (Admin only)
export async function createDoubtPackage(req: Request, res: Response) {
    const { name, description, doubtCount, price, discountedPrice, sortOrder } = req.body;

    if (!name || !doubtCount || !price) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields (name, doubtCount, price)'
        });
    }

    if (doubtCount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Doubt count must be greater than 0'
        });
    }

    if (price <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Price must be greater than 0'
        });
    }

    try {
        const doubtPackage = await prisma.doubtPackage.create({
            data: {
                name,
                description: description || null,
                doubtCount,
                price,
                discountedPrice: discountedPrice || null,
                sortOrder: sortOrder || 0
            }
        });

        res.status(201).json({
            success: true,
            message: 'Doubt package created successfully',
            data: doubtPackage
        });
    } catch (error) {
        console.error('Error in createDoubtPackage:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error
        });
    }
}

export async function createDoubtPackage2(req: Request, res: Response) {
    const { name, description, doubtCount, price, discountedPrice, sortOrder } = req.body;

    if (!name || !doubtCount || !price) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields (name, doubtCount, price)'
        });
    }

    if (doubtCount <= 0 || price <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Price and doubt count must be greater than 0'
        });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const created = await tx.doubtPackage.create({
                data: {
                    name,
                    description: description || null,
                    doubtCount,
                    price,
                    discountedPrice: discountedPrice || null,
                    sortOrder: sortOrder || 0
                }
            });

            const previous = await tx.doubtPackage.findUnique({
                where: { id: created.id - 1 },
                select: { doubtPackageId: true }
            });

            const newDoubtPackageId = previous?.doubtPackageId
                ? previous.doubtPackageId + 1
                : 10001; // first record fallback

            return await tx.doubtPackage.update({
                where: { id: created.id },
                data: { doubtPackageId: newDoubtPackageId }
            });
        });

        return res.status(201).json({
            success: true,
            message: 'Doubt package created successfully',
            data: {
                ...result,
                displayId: String(result.doubtPackageId).padStart(5, '0')
            }
        });

    } catch (error: any) {
        console.error('Error in createDoubtPackage:', error);

        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                error: 'Duplicate doubtPackageId detected. Please retry.'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}


// Update doubt package (Admin only)
export async function updateDoubtPackage(req: Request, res: Response) {
    const { id, name, description, doubtCount, price, discountedPrice, isActive, sortOrder } = req.body;

    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Missing package id'
        });
    }

    try {
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (doubtCount !== undefined) {
            if (doubtCount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Doubt count must be greater than 0'
                });
            }
            updateData.doubtCount = doubtCount;
        }
        if (price !== undefined) {
            if (price <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Price must be greater than 0'
                });
            }
            updateData.price = price;
        }
        if (discountedPrice !== undefined) updateData.discountedPrice = discountedPrice;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

        const doubtPackage = await prisma.doubtPackage.update({
            where: { id },
            data: updateData
        });

        res.status(200).json({
            success: true,
            message: 'Doubt package updated successfully',
            data: doubtPackage
        });
    } catch (error) {
        console.error('Error in updateDoubtPackage:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error
        });
    }
}

// Delete doubt package (Admin only)
export async function deleteDoubtPackage(req: Request, res: Response) {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({
            success: false,
            error: 'Missing package id'
        });
    }

    try {
        // Soft delete by setting isActive to false
        const doubtPackage = await prisma.doubtPackage.update({
            where: { id },
            data: { isActive: false }
        });

        res.status(200).json({
            success: true,
            message: 'Doubt package deleted successfully',
            data: doubtPackage
        });
    } catch (error) {
        console.error('Error in deleteDoubtPackage:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error
        });
    }
}

// Get all doubt packages (Admin - includes inactive)
export async function getAllDoubtPackages(_req: Request, res: Response) {
    try {
        const packages = await prisma.doubtPackage.findMany({
            orderBy: { sortOrder: 'asc' }
        });

        res.status(200).json({
            success: true,
            data: packages
        });
    } catch (error) {
        console.error('Error in getAllDoubtPackages:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error
        });
    }
}

// Admin: Get doubt package purchases with pagination, filters, search & analytics
export async function getAllDoubtPackagePurchasesAdmin(
    req: Request,
    res: Response
) {
    try {
        const {
            page = '1',
            limit = '20',
            search,
            doubtPackageId,
            endUsersId,
            source,
            startDate,
            endDate,
        } = req.body;

        const pageNumber = Math.max(Number(page), 1);
        const pageSize = Math.min(Number(limit), 100);
        const skip = (pageNumber - 1) * pageSize;

        const whereCondition: any = {
            ...(doubtPackageId && {
                doubtPackageId: Number(doubtPackageId),
            }),
            ...(endUsersId && {
                endUsersId: Number(endUsersId),
            }),
            ...(source && {
                source: String(source),
            }),
            ...((startDate || endDate) && {
                createOn: {
                    ...(startDate && { gte: new Date(String(startDate)) }),
                    ...(endDate && { lte: new Date(String(endDate)) }),
                },
            }),
            ...(search && {
                OR: [
                    { orderID: { contains: String(search), mode: 'insensitive' } },
                    {
                        endUsers: {
                            OR: [
                                { name: { contains: String(search), mode: 'insensitive' } },
                                { email: { contains: String(search), mode: 'insensitive' } },
                                { phone: { contains: String(search), mode: 'insensitive' } },
                            ],
                        },
                    },
                ],
            }),
        };

        const [purchases, totalCount] = await Promise.all([
            prisma.doubtPackagePurchases.findMany({
                where: whereCondition,
                orderBy: {
                    createOn: 'desc',
                },
                skip,
                take: pageSize,
                include: {
                    package: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            discountedPrice: true,
                        },
                    },
                    endUsers: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            grade: true,
                        },
                    },
                },
            }),
            prisma.doubtPackagePurchases.count({
                where: whereCondition,
            }),
        ]);

        const analyticsRaw = await prisma.doubtPackagePurchases.aggregate({
            where: whereCondition,
            _sum: {
                amountPaid: true,
                DoubtCount: true,
            },
            _count: {
                id: true,
            },
        });

        const packageWiseAnalytics = await prisma.doubtPackagePurchases.groupBy({
            by: ['doubtPackageId'],
            where: whereCondition,
            _sum: {
                amountPaid: true,
                DoubtCount: true,
            },
            _count: {
                id: true,
            },
        });

        const packageDetails = await prisma.doubtPackage.findMany({
            where: {
                id: {
                    in: packageWiseAnalytics
                        .map(p => p.doubtPackageId)
                        .filter(Boolean) as number[],
                },
            },
            select: {
                id: true,
                name: true,
            },
        });

        const packageMap = new Map(
            packageDetails.map(p => [p.id, p.name])
        );

        const formattedPackageAnalytics = packageWiseAnalytics.map(p => ({
            doubtPackageId: p.doubtPackageId,
            packageName: p.doubtPackageId
                ? packageMap.get(p.doubtPackageId)
                : 'Unknown',
            totalPurchases: p._count.id,
            totalDoubts: p._sum.DoubtCount || 0,
            totalRevenue: p._sum.amountPaid || 0,
        }));

        res.status(200).json({
            success: true,
            pagination: {
                page: pageNumber,
                limit: pageSize,
                totalRecords: totalCount,
                totalPages: Math.ceil(totalCount / pageSize),
            },
            analytics: {
                totalPurchases: analyticsRaw._count.id,
                totalRevenue: analyticsRaw._sum.amountPaid || 0,
                totalDoubtsPurchased: analyticsRaw._sum.DoubtCount || 0,
                packageWise: formattedPackageAnalytics,
            },
            data: purchases,
        });
    } catch (error) {
        console.error('Error in getAllDoubtPackagePurchasesAdmin:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

