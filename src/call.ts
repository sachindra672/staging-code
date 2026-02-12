import { Request, Response } from 'express'
import { generateToken04 } from './zego'

const appId = 1500762473; // Your App ID
const serverSecret = "175fa0e5958efde603f2ec805c7d6120";
const effectiveTimeOut = 1 * 60 * 60 * 24

export async function callToken(req: Request, res: Response) {
    try {
        const { userId } = req.body
        const token = generateToken04(appId, userId, serverSecret, effectiveTimeOut)
        res.send({ success: true, token })
    } catch (error) {
        res.send({ success: false, error })
    }
}