import { Request, Response } from 'express';
import { generateToken04 } from './zego';
const appId = 1500762473; // Your App ID
const serverSecret = "175fa0e5958efde603f2ec805c7d6120";
const effectiveTimeOut = 1 * 60 * 60 * 24

export async function genUserToken(req: Request, res: Response) {
    const { userId } = req.body;

    try {
        const token = generateToken04(appId, userId, serverSecret, effectiveTimeOut, "");
        res.json({ success: true, token });
    } catch (error) {
        console.error('Error generating token:', error);
        res.status(500).json({ success: false, error: 'Failed to generate token' });
    }
}