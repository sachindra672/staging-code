import { types } from "mediasoup";

export type OpenSessionPeer = {
    transports: types.WebRtcTransport[];
    producers: types.Producer[];
    consumers: types.Consumer[];
    peerId: string;
    socketId: string;
    hasMediaControl: boolean;
    name?: string;
    role?: string;
};

export type OpenSessionRoom = {
    router: types.Router;
    peers: Map<string, OpenSessionPeer>;
    pendingSpeakRequests: Map<string, { studentId: string; name: string }>;
};

const openSessionRooms: Map<string, OpenSessionRoom> = new Map();

export const getOpenSessionRoom = (sessionId: string) => openSessionRooms.get(sessionId);

export const addPeerToOpenSessionRoom = (
    sessionId: string,
    peerId: string,
    socketId: string,
    name?: string,
    role?: string,
) => {
    const room = openSessionRooms.get(sessionId);
    if (!room) {
        throw new Error("Open session room not found");
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
        return;
    }

    const peer = room.peers.get(peerId)!;
    peer.socketId = socketId;
};

export const removePeerFromOpenSessionRoom = (sessionId: string, peerId: string) => {
    const room = openSessionRooms.get(sessionId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    peer.producers.forEach((producer) => producer.close());
    peer.transports.forEach((transport) => transport.close());
    peer.consumers.forEach((consumer) => consumer.close());

    room.peers.delete(peerId);
    room.pendingSpeakRequests?.delete(peerId);
};

export const setOpenSessionRoom = (sessionId: string, room: OpenSessionRoom) => {
    openSessionRooms.set(sessionId, room);
};

export const deleteOpenSessionRoom = (sessionId: string) => {
    openSessionRooms.delete(sessionId);
};

export const getAllOpenSessionRooms = () => openSessionRooms;

