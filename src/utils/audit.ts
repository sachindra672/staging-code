import { prisma } from "../misc"
import { AuditAction } from "@prisma/client"; 

type AuditOpts = {
    action: AuditAction; 
    note?: string;
    meta?: any;
    actorMentorId?: number;
    actorAdminId?: number;
    contentId?: number;
    accessRequestId?: number;
    approverAssignmentId?: number;
};

export async function logAudit(o: AuditOpts) {
    const data: any = {
        action: o.action,
        note: o.note,
        meta: o.meta ?? {},
    };

    if (o.actorMentorId) data.actorMentorId = o.actorMentorId;
    if (o.actorAdminId) data.actorAdminId = o.actorAdminId;
    if (o.contentId) data.contentId = o.contentId;
    if (o.accessRequestId) data.accessRequestId = o.accessRequestId;
    if (o.approverAssignmentId) data.approverAssignmentId = o.approverAssignmentId;

    return prisma.auditLog.create({ data });
}
