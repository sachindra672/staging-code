import { Request, Response } from "express";
import { prisma, hashPassword } from "./misc";

export async function InsertSubAdmin(req: Request, res: Response) {
    try {
        const { name, email, password, permissions } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, email, and password are required" });
        }

        const existing = await prisma.subAdmin.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, message: "SubAdmin already exists with this email" });
        }

        const passHash = await hashPassword(password);

        const newSubAdmin = await prisma.subAdmin.create({
            data: {
                name,
                email,
                password: passHash,
                permissions: permissions || {}, 
            },
        });

        const { password: _, ...safeData } = newSubAdmin;

        return res.status(201).json({
            success: true,
            message: "SubAdmin created successfully",
            subAdmin: safeData,
        });
    } catch (error) {
        console.error("Error creating SubAdmin:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function ToggleSubAdminActive(req: Request, res: Response) {
    const { id } = req.body;

    try {
        const subAdmin = await prisma.subAdmin.findUnique({ where: { id } });
        if (!subAdmin) {
            return res.status(404).json({ success: false, message: "SubAdmin not found" });
        }

        const updatedSubAdmin = await prisma.subAdmin.update({
            where: { id },
            data: { isActive: !subAdmin.isActive },
        });

        return res.status(200).json({
            success: true,
            message: `SubAdmin is now ${updatedSubAdmin.isActive ? "active" : "inactive"}`,
            subAdmin: updatedSubAdmin,
        });
    } catch (error) {
        console.error("Error toggling SubAdmin active status:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function UpdateSubAdmin(req: Request, res: Response) {
    const { id,name, email, permissions ,analyticsPermissions} = req.body;

    try {
        const subAdmin = await prisma.subAdmin.findUnique({ where: { id } });
        if (!subAdmin) {
            return res.status(404).json({ success: false, message: "SubAdmin not found" });
        }

        const updatedSubAdmin = await prisma.subAdmin.update({
            where: { id },
            data: {
                name: name ?? subAdmin.name,
                email: email ?? subAdmin.email,
                permissions: permissions ?? subAdmin.permissions,
                analyticsPermissions: analyticsPermissions ?? subAdmin.analyticsPermissions
            },
        });

        const { password, ...safeData } = updatedSubAdmin;

        return res.status(200).json({
            success: true,
            message: "SubAdmin updated successfully",
            subAdmin: safeData,
        });
    } catch (error) {
        console.error("Error updating SubAdmin:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function GetAllSubAdmins(_req: Request, res: Response) {
    try {
        const subAdmins = await prisma.subAdmin.findMany({
            orderBy: { createdAt: "desc" }, // optional: latest first
        });

        // Remove password field before sending response
        const safeSubAdmins = subAdmins.map(({ password, ...rest }) => rest);

        return res.status(200).json({
            success: true,
            subAdmins: safeSubAdmins,
        });
    } catch (error) {
        console.error("Error fetching SubAdmins:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}