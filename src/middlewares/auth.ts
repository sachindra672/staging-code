import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { SECRET, UserRole } from "../misc";

declare global {
    namespace Express {
        interface Request {
            user?: any;
            role?: string;
        }
    }
}

function authRole(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Authorization header missing or invalid" });
        }

        const token = authHeader.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Token missing" });

        try {
            const decoded = jwt.verify(token, SECRET) as any;

            let role: string;
            let info: any;

            if (decoded.role) {
                role = decoded.role;
                info = decoded.info;
            } else if (decoded.user === "user") {
                role = "user";
                info = { user: decoded.phone }
            } else {
                role = UserRole.admin;
                info = { user: decoded.user };
            }

            if (!roles.includes(role)) {
                return res.status(403).json({ success: false, message: "Access denied" });
            }

            req.role = role;
            req.user = info;
            next();
        } catch (error) {
            console.error("JWT verification failed:", error);
            return res.status(401).json({ success: false, message: "Invalid or expired token", error });
        }
    };
}

export const authAdmin = authRole([UserRole.admin, UserRole.subAdmin]);
export const authMentor = authRole([UserRole.mentor,UserRole.subAdmin]);
export const authSubadmin = authRole([UserRole.subAdmin]);
export const authUser = authRole(["user"]);
export const authAdminOrMentor = authRole([UserRole.admin, UserRole.mentor]);
export const authAnyone = authRole([UserRole.admin, UserRole.mentor, "user"])

