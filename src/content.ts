import { Request, Response } from 'express';
import { prisma } from "./misc";
import { logAudit } from './utils/audit';
import { sendMail } from './utils/mail';
import { getPreviewUrl, uploadToS3AndReturnKey } from './utils/s3';
import { SubjectEnum, AuditAction } from "@prisma/client";


//Upload (mentor → pending, routed to grade+subject approver)
export async function ContentUpload(req: Request, res: Response) {
    try {
        const {title, category, classLevel, subject } = req.body; 
        const mentorId = req.user.id;        

        // 1. Find approver for this grade + subject
        const assignment = await prisma.approverAssignment.findFirst({
            where: {
                grade: String(classLevel),
                subject: subject as any, // cast to SubjectEnum
            },
        });

        if (!assignment) {
            return res.status(400).json({ error: "No approver assigned for this grade+subject" });
        }

        // 2. Upload file to S3
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        const s3Key = await uploadToS3AndReturnKey(
            req.file,
            mentorId,
            classLevel,
            subject
        );

        // 3. Create content entry
        const content = await prisma.content.create({
            data: {
                title: title,
                category: category as any, 
                class: String(classLevel),
                subject: subject as any, 
                s3Key,
                uploadedBy: mentorId,
                approverId: assignment.mentorId,
                status: "PENDING",
            },
        });

        // 4. Log audit
        await logAudit({
            action: "CONTENT_UPLOAD",
            contentId: content.id,
            actorMentorId: mentorId,
            note: `Uploaded by mentor ${mentorId} for grade ${classLevel}, subject ${subject}`,
        });

        // 5. Notify approver by email
        const approver = await prisma.mentor.findUnique({
            where: { id: assignment.mentorId },
        });

        if (approver) {
            await sendMail(
                approver.email,
                "New content pending review",
                `Title: ${content.title}\nGrade: ${classLevel}\nSubject: ${subject}\nPlease review.`
            );
        }

        return res.json({ message: "Pending approval", contentId: content.id });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Upload failed" });
    }
}

// Preview(approver / admin only for PENDING)
export async function ContentPreview(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const user = req.user;

        // 1. Find content
        const content = await prisma.content.findUnique({ where: { id } });
        if (!content) {
            return res.status(404).json({ error: "Content not found" });
        }

        // 2. Permission checks
        const isApprover = user.role === "MENTOR" && content.approverId === user.id;
        const isAdmin = user.role === "ADMIN";

        if (content.status === "PENDING" && !(isApprover || isAdmin)) {
            return res.status(403).json({ error: "Not allowed to preview pending content" });
        }

        // 3. Generate signed preview URL 
        const previewUrl = getPreviewUrl(content.s3Key, 300);

        // 4. Log audit
        await logAudit({
            action: "CONTENT_PREVIEW",
            contentId: id,
            actorMentorId: user.role === "MENTOR" ? user.id : undefined,
            actorAdminId: user.role === "ADMIN" ? user.id : undefined,
            note: `Preview requested by ${user.role} ${user.id}`,
        });

        // 5. Response
        return res.json({ previewUrl });
    } catch (err) {
        console.error("Preview failed:", err);
        return res.status(500).json({ error: "Preview failed" });
    }
}

// Approve / Reject (approver mentor)
export async function ContentReview(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const { decision, note } = req.body as {
            decision: "APPROVED" | "REJECTED";
            note?: string;
        };
        const me = req.user;

        // 1. Fetch content
        const content = await prisma.content.findUnique({ where: { id } });
        if (!content) {
            return res.status(404).json({ error: "Content not found" });
        }

        // 2. Ensure reviewer is the assigned approver
        if (content.approverId !== me.id) {
            return res.status(403).json({ error: "You are not the approver for this content" });
        }

        // 3. Update content status
        const updated = await prisma.content.update({
            where: { id },
            data: {
                status: decision,
                rejectionNote: decision === "REJECTED" ? (note || "") : null,
                approvedOn: decision === "APPROVED" ? new Date() : null,
            },
        });

        // 4. Log audit
        await logAudit({
            action: decision === "APPROVED" ? "CONTENT_APPROVE" : "CONTENT_REJECT",
            contentId: id,
            actorMentorId: me.id,
            note: decision === "REJECTED" ? note : undefined,
        });

        // 5. Notify uploader
        const uploader = await prisma.mentor.findUnique({
            where: { id: content.uploadedBy },
        });

        if (uploader) {
            await sendMail(
                uploader.email,
                `Your content was ${decision.toLowerCase()}`,
                decision === "APPROVED"
                    ? `Approved: ${content.title}`
                    : `Rejected: ${content.title}\nNote: ${note || "No note"}`
            );
        }

        // 6. Response
        return res.json(updated);
    } catch (err) {
        console.error("Review failed:", err);
        return res.status(500).json({ error: "Review failed" });
    }
}

// Request access (mentor → admin reviews)
export async function ContentRequestAccess(req: Request, res: Response) {
    try {
        const contentId = Number(req.params.id);
        const me = req.user;

        // 1. Fetch content
        const content = await prisma.content.findUnique({ where: { id: contentId } });
        if (!content || content.status !== "APPROVED") {
            return res.status(400).json({ error: "Content not available" });
        }

        // 2. Prevent self-request
        if (content.uploadedBy === me.id) {
            return res.status(400).json({ error: "You already own this content" });
        }

        // 3. Check if request already exists
        const existing = await prisma.contentAccessRequest.findFirst({
            where: { contentId, requesterId: me.id, status: "PENDING" },
        });
        if (existing) {
            return res.json({ message: "Request already pending" });
        }

        // 4. Create access request
        const reqRow = await prisma.contentAccessRequest.create({
            data: { contentId, requesterId: me.id },
        });

        // 5. Log audit
        await logAudit({
            action: "ACCESS_REQUEST_CREATE",
            accessRequestId: reqRow.id,
            contentId,
            actorMentorId: me.id,
        });

        // 6. Notify all active admins
        const admins = await prisma.admin.findMany({ where: { isActive: true } });
        await Promise.all(
            admins.map((a) =>
                sendMail(
                    a.email,
                    "New content access request",
                    `Content ID: ${contentId}\nRequester mentor ID: ${me.id}`
                )
            )
        );

        // 7. Response
        return res.json({ message: "Access request sent" });
    } catch (err) {
        console.error("Request access failed:", err);
        return res.status(500).json({ error: "Request access failed" });
    }
}

// Approve/Reject access (admin)
export async function AccessRequestReview(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const { decision, note } = req.body as {
            decision: "APPROVED" | "REJECTED";
            note?: string;
        };
        const admin = req.user;

        // 1. Fetch access request with related content + requester
        const ar = await prisma.contentAccessRequest.findUnique({
            where: { id },
            include: { content: true, requester: true },
        });

        if (!ar || ar.status !== "PENDING") {
            return res.status(400).json({ error: "Invalid access request" });
        }

        // 2. Update access request with decision
        const updated = await prisma.contentAccessRequest.update({
            where: { id },
            data: {
                status: decision,
                reviewerId: admin.id,
                decisionNote: note || null,
                decidedOn: new Date(),
            },
        });

        // 3. Log audit
        await logAudit({
            action: decision === "APPROVED" ? "ACCESS_REQUEST_APPROVE" : "ACCESS_REQUEST_REJECT",
            accessRequestId: id,
            contentId: ar.contentId,
            actorAdminId: admin.id,
            note,
        });

        // 4. If approved → grant access
        if (decision === "APPROVED") {
            await prisma.contentAccess.upsert({
                where: {
                    contentId_mentorId: {
                        contentId: ar.contentId,
                        mentorId: ar.requesterId,
                    },
                },
                create: { contentId: ar.contentId, mentorId: ar.requesterId },
                update: {},
            });
        }

        // 5. Notify requester
        await sendMail(
            ar.requester.email,
            `Your access request was ${decision.toLowerCase()}`,
            decision === "APPROVED"
                ? `✅ Approved for content ${ar.contentId}`
                : `❌ Rejected for content ${ar.contentId}\nNote: ${note || "No note"}`
        );

        // 6. Response
        return res.json(updated);
    } catch (err) {
        console.error("Access request review failed:", err);
        return res.status(500).json({ error: "Access request review failed" });
    }
}

// Assign/Reassign approver (admin)
export async function ApproverAssign(req: Request, res: Response) {
    try {
        const { grade, subject, mentorId } = req.body;
        const admin = req.user;

        // 1. Validate subject enum
        if (!Object.values(SubjectEnum).includes(subject)) {
            return res.status(400).json({ error: `Invalid subject: ${subject}` });
        }

        // 2. Check if assignment already exists
        const existing = await prisma.approverAssignment.findUnique({
            where: {
                grade_subject: {
                    grade: String(grade),
                    subject: subject as SubjectEnum,
                },
            },
        });

        // 3. Create or update approver assignment
        const record = await prisma.approverAssignment.upsert({
            where: {
                grade_subject: {
                    grade: String(grade),
                    subject: subject as SubjectEnum,
                },
            },
            create: {
                grade: String(grade),
                subject: subject as SubjectEnum,
                mentorId: Number(mentorId),
            },
            update: { mentorId: Number(mentorId) },
        });

        // 4. Log audit
        await logAudit({
            action: existing ? AuditAction.APPROVER_REASSIGN : AuditAction.APPROVER_ASSIGN,
            approverAssignmentId: record.id,
            actorAdminId: admin.id,
            note: `grade=${grade}, subject=${subject}, mentorId=${mentorId}`,
        });

        // 5. Response
        return res.json(record);
    } catch (err) {
        console.error("Approver assign failed:", err);
        return res.status(500).json({ error: "Approver assign failed" });
    }
}

// Admin-only: audit history listing
export async function AdminAuditLogs(req: Request, res: Response) {
    try {
        const { action, contentId, accessRequestId, page = 1, pageSize = 50 } = req.query as any;

        // 1. Build filters
        const where: any = {};
        if (action) where.action = action;
        if (contentId) where.contentId = Number(contentId);
        if (accessRequestId) where.accessRequestId = Number(accessRequestId);

        // 2. Fetch logs with pagination
        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { createdOn: "desc" },
            take: Number(pageSize),
            skip: (Number(page) - 1) * Number(pageSize),
            include: {
                actorAdmin: { select: { id: true, name: true, email: true } },
                actorMentor: { select: { id: true, name: true, email: true } },
                content: {
                    select: {
                        id: true,
                        title: true,
                        class: true,
                        subject: true, 
                        status: true,
                    },
                },
                accessRequest: {
                    select: {
                        id: true,
                        status: true,
                        contentId: true,
                        requesterId: true,
                    },
                },
                approverAssignment: {
                    select: {
                        id: true,
                        grade: true,
                        subject: true, // ✅ enum field
                        mentorId: true,
                    },
                },
            },
        });

        // 3. Response
        return res.json(logs);
    } catch (err) {
        console.error("Fetch audit logs failed:", err);
        return res.status(500).json({ error: "Failed to fetch audit logs" });
    }
}
