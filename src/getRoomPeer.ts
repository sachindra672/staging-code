import { Request, Response } from "express";
import { getRoom, getRoom2 } from "./mediasoup/roomManager";

export const getPeersInSession = async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const room = getRoom2(sessionId);

        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }

        const peers = Array.from(room.peers.values()).map(peer => ({
            id: peer.peerId,
            name: peer.name,
            role: peer.role,
            hasMediaControl: peer.hasMediaControl || false,
            socketId: peer.socketId,
            producers: peer.producers?.map(p => ({
                id: p.id,
                kind: p.kind,
                source: p.appData?.source,
            })) || [],
        }));

        return res.json({ sessionId, peers });
    } catch (error) {
        console.error("Error fetching peers:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
