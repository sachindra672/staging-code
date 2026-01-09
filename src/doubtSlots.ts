import { Request, Response } from "express";
import { prisma } from "./misc";

/**
 * Create a new doubt slot for a mentor
 * POST /teacher/create_doubt_slot
 */
export async function createDoubtSlot(req: Request, res: Response) {
    const { mentorId, dayOfWeek, startTime, endTime, maxCapacity } = req.body;

    if (!mentorId || !dayOfWeek || !startTime || !endTime) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields (mentorId, dayOfWeek, startTime, endTime)'
        });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
        return res.status(400).json({
            success: false,
            error: 'Start time must be before end time'
        });
    }

    try {
        const slot = await prisma.doubtSlot.create({
            data: {
                mentorId,
                dayOfWeek,
                startTime: start,
                endTime: end,
                maxCapacity: maxCapacity || 1,
                currentBookings: 0,
                isAvailable: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Doubt slot created successfully',
            data: slot
        });
    } catch (error) {
        console.error('Error in createDoubtSlot:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get all available slots for a mentor
 * POST /teacher/get_doubt_slots
 */
export async function getDoubtSlots(req: Request, res: Response) {
    const { mentorId } = req.body;

    if (!mentorId) {
        return res.status(400).json({
            success: false,
            error: 'Missing mentorId'
        });
    }

    try {
        const slots = await prisma.doubtSlot.findMany({
            where: { mentorId },
            include: { bookedDoubts: true },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
        });

        res.status(200).json({
            success: true,
            data: slots
        });
    } catch (error) {
        console.error('Error in getDoubtSlots:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get available slots for a mentor (only slots with availability)
 * POST /get_available_doubt_slots
 */
export async function getAvailableDoubtSlots(req: Request, res: Response) {
    const { mentorId } = req.body

    if (!mentorId) {
        return res.status(400).json({
            success: false,
            error: 'Missing mentorId'
        })
    }

    try {
        const today = new Date()

        const dayNames = [
            'sunday',
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday'
        ]

        const todayDay = dayNames[today.getDay()]

        const slots = await prisma.doubtSlot.findMany({
            where: {
                mentorId,
                dayOfWeek: {
                    in: [
                        todayDay,                                      
                        todayDay.toUpperCase(),                        
                        todayDay[0].toUpperCase() + todayDay.slice(1) 
                    ]
                }
            },
            include: {
                bookedDoubts: true
            },
            orderBy: {
                startTime: 'asc'
            }
        })

        console.log(slots);

        const now = new Date()

        const enhancedSlots = slots.map(slot => {
            const endTime = new Date(slot.endTime)

            let slotStatus: 'passed' | 'booked' | 'available' = 'available'

            if (endTime <= now) {
                slotStatus = 'passed'
            } else if (
                slot.currentBookings >= (slot.maxCapacity || 1) ||
                slot.isAvailable === false
            ) {
                slotStatus = 'booked'
            }

            return {
                ...slot,
                slotStatus,
                bookingsCount: slot.currentBookings,
                statusIdentifier: slotStatus
            }
        })

        console.log(enhancedSlots);

        const totalAvailable = enhancedSlots.filter(s => s.slotStatus === 'available').length
        const totalBooked = enhancedSlots.filter(s => s.slotStatus === 'booked').length
        const totalPassed = enhancedSlots.filter(s => s.slotStatus === 'passed').length

        return res.status(200).json({
            success: true,
            data: enhancedSlots,
            totals: {
                totalAvailable,
                totalBooked,
                totalPassed
            }
        })
    } catch (error) {
        console.error('Error in getAvailableDoubtSlots:', error)

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}

/**
 * Update a doubt slot
 * POST /teacher/update_doubt_slot
 */
export async function updateDoubtSlot(req: Request, res: Response) {
    const { slotId, dayOfWeek, startTime, endTime, maxCapacity, isAvailable } = req.body;

    if (!slotId) {
        return res.status(400).json({
            success: false,
            error: 'Missing slotId'
        });
    }

    try {
        const updateData: any = {};
        if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
        if (startTime !== undefined) updateData.startTime = new Date(startTime);
        if (endTime !== undefined) updateData.endTime = new Date(endTime);
        if (maxCapacity !== undefined) updateData.maxCapacity = maxCapacity;
        if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

        const slot = await prisma.doubtSlot.update({
            where: { id: slotId },
            data: updateData
        });

        res.status(200).json({
            success: true,
            message: 'Doubt slot updated successfully',
            data: slot
        });
    } catch (error) {
        console.error('Error in updateDoubtSlot:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Delete a doubt slot
 * POST /teacher/delete_doubt_slot
 */
export async function deleteDoubtSlot(req: Request, res: Response) {
    const { slotId } = req.body;

    if (!slotId) {
        return res.status(400).json({
            success: false,
            error: 'Missing slotId'
        });
    }

    try {
        // Check if slot exists & is active
        const slot = await prisma.doubtSlot.findUnique({
            where: { id: slotId }
        });

        if (!slot || slot.isActive === false) {
            return res.status(404).json({
                success: false,
                error: 'Slot not found or already deleted'
            });
        }

        // Check if slot has any active bookings
        const activeBookings = await prisma.doubtSlotBooking.findMany({
            where: {
                slotId,
                status: 'scheduled'
            }
        });

        if (activeBookings.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete slot with active bookings',
                activeBookingCount: activeBookings.length
            });
        }

        // 🔒 SOFT DELETE
        await prisma.doubtSlot.update({
            where: { id: slotId },
            data: {
                isActive: false,
                isAvailable: false,
                modifiedOn: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Doubt slot deleted successfully (soft delete)'
        });
    } catch (error) {
        console.error('Error in deleteDoubtSlot:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}


/**
 * Book a slot for a doubt
 * POST /book_doubt_slot (Called internally when creating doubt)
 */
export async function bookDoubtSlot(req: Request, res: Response) {
    const { slotId, doubtId, mentorId, studentId } = req.body;

    if (!slotId || !doubtId || !mentorId || !studentId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields (slotId, doubtId, mentorId, studentId)'
        });
    }

    try {
        // Check if slot is available
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
                error: 'Slot is not available for booking'
            });
        }

        // Check if doubt already has a slot booking
        const existingBooking = await prisma.doubtSlotBooking.findFirst({
            where: { doubtId }
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                error: 'Doubt already has a slot booking'
            });
        }

        // Book the slot in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create booking
            const booking = await tx.doubtSlotBooking.create({
                data: {
                    slotId,
                    doubtId,
                    mentorId,
                    studentId,
                    status: 'scheduled'
                }
            });

            // Update slot bookings count
            await tx.doubtSlot.update({
                where: { id: slotId },
                data: { currentBookings: { increment: 1 } }
            });

            return booking;
        });

        res.status(201).json({
            success: true,
            message: 'Doubt slot booked successfully',
            data: result
        });
    } catch (error) {
        console.error('Error in bookDoubtSlot:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Cancel a slot booking
 * POST /teacher/cancel_doubt_slot_booking
 */
export async function cancelSlotBooking(req: Request, res: Response) {
    const { bookingId } = req.body;

    if (!bookingId) {
        return res.status(400).json({
            success: false,
            error: 'Missing bookingId'
        });
    }

    try {
        const booking = await prisma.doubtSlotBooking.findUnique({
            where: { id: bookingId }
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Cancel booking in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update booking status
            const updatedBooking = await tx.doubtSlotBooking.update({
                where: { id: bookingId },
                data: { status: 'cancelled' }
            });

            // Decrement slot bookings count
            await tx.doubtSlot.update({
                where: { id: booking.slotId },
                data: { currentBookings: { decrement: 1 } }
            });

            return updatedBooking;
        });

        res.status(200).json({
            success: true,
            message: 'Slot booking cancelled successfully',
            data: result
        });
    } catch (error) {
        console.error('Error in cancelSlotBooking:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Mark slot booking as completed
 * POST /teacher/complete_doubt_slot_booking
 */
export async function completeSlotBooking(req: Request, res: Response) {
    const { bookingId } = req.body;

    if (!bookingId) {
        return res.status(400).json({
            success: false,
            error: 'Missing bookingId'
        });
    }

    try {
        // Fetch booking first
        const booking = await prisma.doubtSlotBooking.findUnique({
            where: { id: bookingId }
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Prevent double completion
        if (booking.status === 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Booking already completed'
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedBooking = await tx.doubtSlotBooking.update({
                where: { id: bookingId },
                data: {
                    status: 'completed',
                    completedOn: new Date()
                },
                include: {
                    slot: true,
                    doubt: true,
                    mentor: true,
                    student: true
                }
            });

            await tx.doubtSlot.update({
                where: { id: booking.slotId },
                data: {
                    currentBookings: {
                        decrement: 1
                    }
                }
            });

            return updatedBooking;
        });

        return res.status(200).json({
            success: true,
            message: 'Slot booking marked as completed and slot freed',
            data: result
        });
    } catch (error) {
        console.error('Error in completeSlotBooking:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get mentor's slot bookings
 * POST /teacher/get_slot_bookings
 */
export async function getMentorSlotBookings(req: Request, res: Response) {
    const { mentorId } = req.body;

    if (!mentorId) {
        return res.status(400).json({
            success: false,
            error: 'Missing mentorId'
        });
    }

    try {
        const bookings = await prisma.doubtSlotBooking.findMany({
            where: { mentorId },
            include: {
                slot: true,
                doubt: {
                    include: {
                        asker: true
                    }
                },
                student: true
            },
            orderBy: { createdOn: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: bookings,
            totalBookings: bookings.length
        });
    } catch (error) {
        console.error('Error in getMentorSlotBookings:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get student's slot bookings
 * POST /get_my_doubt_slot_bookings
 */
export async function getStudentSlotBookings(req: Request, res: Response) {
    const { studentId } = req.body;

    if (!studentId) {
        return res.status(400).json({
            success: false,
            error: 'Missing studentId'
        });
    }

    try {
        const bookings = await prisma.doubtSlotBooking.findMany({
            where: { studentId },
            include: {
                slot: true,
                doubt: true,
                mentor: true
            },
            orderBy: { createdOn: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: bookings,
            totalBookings: bookings.length
        });
    } catch (error) {
        console.error('Error in getStudentSlotBookings:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
