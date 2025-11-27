import { types } from 'mediasoup';

export type VcPeer = {
    transports: types.WebRtcTransport[],
    sendTransport?: types.WebRtcTransport,  
    recvTransport?: types.WebRtcTransport,
    producers: types.Producer[],
    consumers: types.Consumer[],
    peerId: string,
    socketId: string,
    name?: string,
    role?: string,
};

export type VcRoom = {
    router: types.Router,
    peers: Map<string, VcPeer>
};

export const videoRooms: Map<string, VcRoom> = new Map();

export const getVideoRoom = (callId: string) => videoRooms.get(callId);

export const addPeerToVideoRoom = (callId: string, peerId: string, socketId: string, name?: string, role?: string) => {
    const room = videoRooms.get(callId);
    if (!room) {
        throw new Error('Video room not found');
    }

    if (!room.peers.has(peerId)) {
        room.peers.set(peerId, {
            transports: [],
            sendTransport: undefined,  
            recvTransport: undefined, 
            producers: [],
            consumers: [],
            name,
            role,
            peerId,
            socketId,
        });
    } else {
        const peer = room.peers.get(peerId)!;
        peer.socketId = socketId;
    }
};

export const removePeerFromVideoRoom = (callId: string, peerId: string) => {
    const room = videoRooms.get(callId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    peer.producers.forEach(p => p.close());
    peer.transports.forEach(t => t.close());
    peer.consumers.forEach(c => c.close());
    room.peers.delete(peerId);
};


