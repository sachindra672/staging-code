import { types } from "mediasoup";

export type RecordingKind = "audio" | "video" | "screen";

export type Peer = {
    transports: types.WebRtcTransport[],
    producers: types.Producer[],
    consumers: types.Consumer[],
    peerId: string,
    socketId: string,
    hasMediaControl: boolean,
    name?: string,
    role?: string
};

export type Room = {
    router: types.Router;
    peers: Map<string, Peer>;
    pendingSpeakRequests: Map<string, { studentId: string; name: string }>;
    recorderTransports?: Map<
        RecordingKind,
        { senderTransport: types.PlainTransport; consumer: types.Consumer; codec: types.RtpCodecParameters; }
    >;
};

export const rooms: Map<string, Room> = new Map();

export const getRoom = (sessionId: string) => rooms.get(sessionId);

export const getRoom2 = (sessionId: string | number) => {
    const idStr = String(sessionId);
    const idNum = Number(sessionId);
    console.log("Looking for room:", sessionId, "→ type:", typeof sessionId);
    const allKeys = Array.from(rooms.keys());
    console.log(
        "Current rooms:",
        allKeys.map(k => `${k} (type: ${typeof k})`)
    );
    // Try both string and number keys
    let room = rooms.get(idStr as any);
    if (!room && rooms.has(idNum as any)) {
        room = rooms.get(idNum as any);
    }
    if (!room) {
        console.warn("⚠️ Room not found for:", sessionId);
    } else {
        console.log("✅ Room found for:", sessionId);
    }
    return room;
};

export const addPeerToRoom = (sessionId: string, peerId: string, socketId: string, name?: string, role?: string) => {
    let room = rooms.get(sessionId);
    if (!room) {
        throw new Error('Room not found');
    }
    if (!room.pendingSpeakRequests) {
        room.pendingSpeakRequests = new Map();
    }
    if (!room.peers.has(peerId)) {
        room.peers.set(peerId, {
            transports: [],
            producers: [],
            consumers: [],
            name,
            role,
            peerId,
            socketId,
            hasMediaControl: false,
        });
    } else {
        const peer = room.peers.get(peerId)!;
        peer.socketId = socketId;
    }
};

export const removePeerFromRoom = (sessionId: string, peerId: string) => {
    const room = rooms.get(sessionId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    // Close peer’s producers and transports
    peer.producers.forEach(p => p.close());
    peer.transports.forEach(t => t.close());

    // 🩹 IMPORTANT FIX: If mentor leaves, clear recorder transports
    if (peer.role === "mentor" && room.recorderTransports) {
        for (const [k, rec] of room.recorderTransports) {
            try { rec.consumer.close(); } catch {}
            try { rec.senderTransport.close(); } catch {}
        }
        room.recorderTransports.clear();
        console.log(`🧹 Cleared recorder transports because mentor left (${sessionId})`);
    }

    // Remove peer
    room.peers.delete(peerId);
    room.pendingSpeakRequests?.delete(peerId);
};


export const addRecordingTransport = (
    sessionId: string,
    kind: RecordingKind,
    senderTransport: types.PlainTransport,
    consumer: types.Consumer
) => {
    const room = rooms.get(sessionId);
    if (!room) throw new Error(`Room not found: ${sessionId}`);
    if (!room.recorderTransports) room.recorderTransports = new Map();

    const existing = room.recorderTransports.get(kind);
    if (existing) {
        try {
            existing.consumer.close();
        } catch (err) {
            console.warn(`Error closing previous consumer for ${kind}:`, err);
        }
        try {
            existing.senderTransport.close();
        } catch (err) {
            console.warn(`Error closing previous sender transport for ${kind}:`, err);
        }
    }

    room.recorderTransports.set(kind, {
        senderTransport,
        consumer,
        codec: consumer.rtpParameters.codecs[0]
    });

    console.log(`Recording transport added for ${sessionId} (${kind})`);
};

export const stopRecordingTransports = async (sessionId: string, kind?: RecordingKind) => {
    const room = rooms.get(sessionId);
    if (!room || !room.recorderTransports) return;

    if (kind) {
        const transport = room.recorderTransports.get(kind);
        if (!transport) return;
        try {
            transport.consumer.close();
        } catch (err) {
            console.error(`Error closing recorder consumer for ${kind}:`, err);
        }
        try {
            transport.senderTransport.close();
        } catch (err) {
            console.error(`Error closing recorder sender transport for ${kind}:`, err);
        }
        room.recorderTransports.delete(kind);
        return;
    }

    for (const [currentKind, { senderTransport, consumer }] of room.recorderTransports) {
        try {
            consumer.close();
            senderTransport.close();
            console.log(`Closed recording transport for ${currentKind}`);
        } catch (err) {
            console.error(`Error closing recorder transport for ${currentKind}:`, err);
        }
    }

    room.recorderTransports.clear();
};
