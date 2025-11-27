import { io } from '.';
import { prisma } from './misc'
import { Request, Response } from 'express'


export async function createGroupForCourse(bigCourseId: number) {
    const bigCourse = await prisma.bigCourse.findUnique({
        where: { id: bigCourseId }
    });

    if (!bigCourse) throw new Error('BigCourse not found');


    const mentors = await prisma.mentor.findMany({
        where: {
            id: {
                in: bigCourse.mentorList
            }
        }
    });

    const group = await prisma.groupChat.create({
        data: {
            bigCourseId: bigCourse.id,
            groupChatName: `Grade-${bigCourse.grade}-${bigCourse.slug}`,
            members: {
                create: [
                    {
                        adminId: 1,
                        isAdmin: true
                    },
                    ...mentors.map((mentor) => ({
                        mentorId: mentor.id
                    }))
                ]
            }
        }
    });

    return group;
}

export async function addStudentToGroup(userId: number, bigCourseId: number) {
    const group = await prisma.groupChat.findFirst({
        where: { bigCourseId }
    });

    if (!group) {
        throw new Error('Group not found');
    }

    const alreadyMember = await prisma.groupMember.findFirst({
        where: {
            groupId: group.id,
            userId
        }
    });

    if (!alreadyMember) {
        await prisma.groupMember.create({
            data: {
                groupId: group.id,
                userId
            }
        });
    }
}

export const sendMessage = async (
    senderId: number,
    senderType: 'ADMIN' | 'STUDENT' | 'MENTOR',
    groupId: number,
    content: string
) => {
    let senderName = '';

    if (senderType === 'ADMIN') {
        const member = await prisma.groupMember.findUnique({ where: { id: senderId } })
        const admin = await prisma.admin.findUnique({ where: { id: member?.adminId ?? undefined } });
        if (!admin) throw new Error('Admin not found');
        senderName = admin.name;
    } else if (senderType === 'MENTOR') {
        const member = await prisma.groupMember.findUnique({ where: { id: senderId } })
        const mentor = await prisma.mentor.findUnique({ where: { id: member?.mentorId ?? undefined } });
        if (!mentor) throw new Error('Mentor not found');
        senderName = mentor.name;
    } else if (senderType === 'STUDENT') {
        const member = await prisma.groupMember.findUnique({ where: { id: senderId } })
        const student = await prisma.endUsers.findUnique({ where: { id: member?.userId ?? undefined } });
        if (!student) throw new Error('Student not found');
        senderName = student.name ?? 'Unknown Student';
    }

    return prisma.groupMessage.create({
        data: {
            content,
            senderId,
            senderName,
            senderType,
            groupId,
            deliveredAt: new Date(),
            readBy: {
                create: [
                    {
                        memberId: senderId,
                        readAt: new Date()
                    }
                ]
            }
        }
    });
};

export const markAsRead = async (
    messageId: number,
    memberId: number
) => {
    return prisma.readReceipt.create({
        data: {
            messageId,
            memberId,
            readAt: new Date()
        }
    });
};

export const getRecentMessages = async (groupId: number) => {
    return prisma.groupMessage.findMany({
        where: { groupId },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
            readBy: true
        }
    });
};

export const sendGroupMessage = async (req: Request, res: Response) => {
    const { senderId, senderType, groupId, content } = req.body;
    try {
        const message = await sendMessage(senderId, senderType, groupId, content);
        res.json(message);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send message' });
    }
}

export const markReadGroupMessage = async (req: Request, res: Response) => {
    const { messageId, memberId } = req.body;
    try {
        const receipt = await markAsRead(messageId, memberId);
        res.json(receipt);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
}

export const getRecentMessagesGroup = async (req: Request, res: Response) => {
    const groupId = Number(req.params.groupId);
    try {
        const messages = await getRecentMessages(groupId);
        res.status(200).json({
            success: true,
            messages
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
}

export const getAllGroupsAdmin = async (_req: Request, res: Response) => {
    const groups = await prisma.groupChat.findMany({ include: { members: true } });
    res.json(groups);
};

export const getMentorGroups = async (req: Request, res: Response) => {
    const mentorId = Number(req.params.mentorId);
    const groups = await prisma.groupChat.findMany({
        where: { members: { some: { mentorId } } },
        include: { members: true }
    });
    res.json(groups);
};

export const getStudentGroups = async (req: Request, res: Response) => {
    try {
        const studentId = Number(req.params.studentId);

        if (isNaN(studentId)) {
            return res.status(400).json({ error: 'Invalid studentId' });
        }

        const groups = await prisma.groupChat.findMany({
            where: {
                members: {
                    some: {
                        userId: studentId,
                    },
                },
            },
            include: {
                members: true,
            },
        });

        res.status(200).json({
            success: true,
            groups
        });
    } catch (error) {
        console.error('Error fetching student groups:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getGroupMessages = async (req: Request, res: Response) => {
    const groupId = Number(req.params.groupId);
    const take = Number(req.query.take) || 50;

    try {
        const messages = await prisma.groupMessage.findMany({
            where: { groupId },
            orderBy: { createdAt: 'desc' },
            take,
            include: {
                readBy: true
            }
        });
        res.status(200).json({
            success: true,
            messages
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
};

export const updateGroupType = async (req: Request, res: Response) => {
    const { groupId, groupType } = req.body;

    try {
        const updated = await prisma.groupChat.update({
            where: { id: groupId },
            data: { groupType }
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "Failed to update group type" });
    }
};

export const deleteMessage = async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const { deletedBy } = req.body;

    try {
        const message = await prisma.groupMessage.update({
            where: { id: Number(messageId) },
            data: {
                deleted: true,
                deletedBy
            }
        });

        io.to(`group-${message.groupId}`).emit('message-deleted', message.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete message' });
    }
};

export const markMessagesAsRead = async (req: Request, res: Response) => {
    const { memberId, messageIds } = req.body;

    try {
        await prisma.readReceipt.deleteMany({
            where: {
                memberId,
                messageId: { in: messageIds }
            }
        });

        await prisma.readReceipt.createMany({
            data: messageIds.map((messageId: any) => ({
                messageId,
                memberId,
                readAt: new Date()
            }))
        });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
};

export async function getNameByType(senderId: number, senderType: 'ADMIN' | 'MENTOR' | 'STUDENT') {
    if (senderType === 'ADMIN') {
        const member = await prisma.groupMember.findUnique({ where: { id: senderId } })
        const admin = await prisma.admin.findUnique({ where: { id: member?.adminId ?? undefined } });
        return admin?.name || 'Admin';
    }
    if (senderType === 'MENTOR') {
        const member = await prisma.groupMember.findUnique({ where: { id: senderId } })
        const mentor = await prisma.mentor.findUnique({ where: { id: member?.mentorId ?? undefined } });
        return mentor?.name || 'Mentor';
    }
    if (senderType === 'STUDENT') {
        const member = await prisma.groupMember.findUnique({ where: { id: senderId } })
        const student = await prisma.endUsers.findUnique({ where: { id: member?.userId ?? undefined } });
        return student?.name || 'Student';
    }
    return 'Unknown';
}

export const getReadReciept = async (req: Request, res: Response) => {
    const messageId = Number(req.params.messageId);

    if (isNaN(messageId)) {
        return res.status(400).json({ error: 'Invalid message ID' });
    }

    try {
        const receipts = await prisma.readReceipt.findMany({
            where: { messageId },
            include: {
                member: {
                    include: {
                        admin: { select: { name: true } },
                        mentor: { select: { name: true } },
                        user: { select: { name: true } },
                    },
                },
            },
        });

        const formattedReceipts = receipts.map((receipt) => {
            const { member, ...rest } = receipt;

            const name =
                member.admin?.name ||
                member.mentor?.name ||
                member.user?.name ||
                'Unknown';

            return {
                ...rest,
                member: {
                    id: member.id,
                    name,
                },
                readAt: receipt.readAt,
            };
        });

        res.json({ messageId, receipts: formattedReceipts });
    } catch (error) {
        console.error('Error fetching read receipts:', error);
        res.status(500).json({ error: 'Failed to fetch read receipts' });
    }
}

export async function createEmptyGroupForCourse(
    bigCourseId: number,
    adminId: number,
    groupChatName?: string
) {
    const bigCourse = await prisma.bigCourse.findUnique({
        where: { id: bigCourseId },
    });

    if (!bigCourse) throw new Error('BigCourse not found');

    const name = groupChatName || `Grade-${bigCourse.grade}-${bigCourse.slug}`;

    const group = await prisma.groupChat.create({
        data: {
            bigCourseId: bigCourse.id,
            groupChatName: name,
            members: {
                create: [
                    {
                        adminId,
                        isAdmin: true,
                    },
                    ...bigCourse.mentorList.map((mentorId) => ({
                        mentorId,
                        isAdmin: false,
                    })),
                ],
            },
        },
    });

    return group;
}

export const createGroupEndpoint = async (req: Request, res: Response) => {
    const { bigCourseId, adminId, groupChatName } = req.body;

    try {
        const group = await createEmptyGroupForCourse(bigCourseId, adminId, groupChatName);
        res.status(201).json(group);
    } catch (err) {
        res.status(500).json({ error: 'Group creation failed', detail: (err as Error).message });
    }
};

export async function addMemberToGroup(
    groupId: number,
    memberData: { userId: number }
) {
    if (!memberData.userId) {
        throw new Error('Only student is allowed.');
    }

    const exists = await prisma.groupMember.findFirst({
        where: {
            groupId,
            userId: memberData.userId,
        },
    });

    if (!exists) {
        await prisma.groupMember.create({
            data: {
                groupId,
                userId: memberData.userId,
                isAdmin: false,
            },
        });
    }
}

export const addGroupMemberEndpoint = async (req: Request, res: Response) => {
    const { groupId, userId } = req.body;

    if (!groupId || isNaN(Number(groupId))) {
        return res.status(400).json({ error: 'Valid groupId is required in the body' });
    }

    if (!userId || isNaN(Number(userId))) {
        return res.status(400).json({ error: 'Valid userId is required in the body' });
    }

    try {
        await addMemberToGroup(Number(groupId), { userId: Number(userId) });
        return res.status(200).json({ success: true, message: 'Student added to group successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to add student to group', detail: (err as Error).message });
    }
};

export async function addMentorToGroup(
    groupId: number,
    memberData: { mentorId: number; isAdmin?: boolean }
) {
    if (!memberData.mentorId) {
        throw new Error('mentorId is required.');
    }

    const exists = await prisma.groupMember.findFirst({
        where: {
            groupId,
            mentorId: memberData.mentorId,
        },
    });

    if (!exists) {
        await prisma.groupMember.create({
            data: {
                groupId,
                mentorId: memberData.mentorId,
                isAdmin: memberData.isAdmin ?? false,
            },
        });
    }
}

export const addMentorToGroupEndpoint = async (req: Request, res: Response) => {
    const { groupId, mentorId, isAdmin } = req.body;

    if (!groupId || isNaN(Number(groupId))) {
        return res.status(400).json({ error: 'Valid groupId is required in the body' });
    }

    if (!mentorId || isNaN(Number(mentorId))) {
        return res.status(400).json({ error: 'Valid mentorId is required in the body' });
    }

    try {
        await addMentorToGroup(Number(groupId), { mentorId: Number(mentorId), isAdmin });
        return res.status(200).json({ success: true, message: 'Mentor added to group successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to add mentor to group', detail: (err as Error).message });
    }
};










