import express from "express";
import { authAdmin, authMentor, authAdminOrMentor, authUser } from "../middlewares/auth";

const router = express.Router();


router.get("/check-admin", authAdmin, (req, res) => {
    res.json({
        success: true,
        message: "You are an Admin",
        role: req.role,
        user: req.user,
    });
});

router.get("/check-mentor", authMentor, (req, res) => {
    res.json({
        success: true,
        message: "You are a Mentor",
        role: req.role,
        user: req.user,
    });
});

router.get("/check-endUser", authUser, (req, res) => {
    res.json({
        success: true,
        message: "You are a endUser",
        role: req.role,
        user: req.user,
    });
});

router.get("/check-admin-or-mentor", authAdminOrMentor, (req, res) => {
    res.json({
        success: true,
        message: "You are either an Admin or a Mentor",
        role: req.role,
        user: req.user,
    });
});

export default router;
