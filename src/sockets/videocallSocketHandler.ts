import { Server, Socket } from 'socket.io';
import { Worker, Router, Transport, Producer, Consumer } from 'mediasoup/node/lib/types';
import { createRoomWithBalancedWorker } from '../mediasoup/createRoomWithBalancedWorker';
import { addPeerToRoom, getRoom } from '../mediasoup/roomManager';

export const videoCallSocketHandler = (io: Server, socket: Socket, workers: Worker[]) => {
    const user = (socket as any).user;
    if (!user) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
    }

    // Helper - emit participant list (simple)
    const emitParticipants = (roomId: string) => {
        const room = getRoom(roomId);
        if (!room) return;
        const participants = Array.from(room.peers.values()).map(p => ({
            id: p.peerId,
            name: p.name,
            socketId: p.socketId,
            role: p.role
        }));
        io.to(roomId).emit('participants-updated', participants);
    };

    // Join a 1:1 call
    socket.on('join-call', async ({ roomId, role }: { roomId: string; role: 'mentor' | 'student' }, callback: any) => {
        try {
            if (!roomId) return callback({ success: false, error: 'roomId required' });

            // Create or get mediasoup room/router
            const room = await createRoomWithBalancedWorker(roomId, workers);
            if (!room) return callback({ success: false, error: 'Failed to create room' });

            // Ensure room is 1:1
            const existingCount = room.peers.size;
            if (existingCount >= 2 && !room.peers.has(user.info.uuid)) {
                return callback({ success: false, error: 'Room full' });
            }

            // Enforce single mentor
            if (role === 'mentor') {
                const hasMentor = Array.from(room.peers.values()).some(p => p.role === 'mentor');
                if (hasMentor && !room.peers.has(user.info.uuid)) {
                    return callback({ success: false, error: 'Mentor already present' });
                }
            }

            // Add peer to room manager
            addPeerToRoom(roomId, user.info.uuid, socket.id, user.info.name, role); // keep structure similar to classroom
            (socket as any)._roomId = roomId;
            (socket as any)._role = role;

            // Send router rtp capabilities to client
            if (room.router && room.router.rtpCapabilities) {
                socket.emit('router-rtp-capabilities', room.router.rtpCapabilities);
            }

            // Inform other participant
            socket.to(roomId).emit('peer-joined', { userId: user.info.uuid, name: user.info.name, role });

            emitParticipants(roomId);
            callback({ success: true, role });
        } catch (err) {
            console.error('join-call error', err);
            callback({ success: false, error: (err as Error).message || String(err) });
        }
    });

    // Create mediasoup WebRTC transport on server (router.createWebRtcTransport)
    socket.on('create-transport', async ({ roomId }, callback) => {
        try {
            const room = getRoom(roomId);
            if (!room) throw new Error('Room not found');
            const router: Router = room.router;

            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: 1000000,
            });

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');
            peer.transports.push(transport);

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
                sctpParameters: (transport as any).sctpParameters || null,
            });
        } catch (err) {
            console.error('create-transport error', err);
            callback({ error: (err as Error).message || 'create-transport failed' });
        }
    });

    socket.on('connect-transport', async ({ roomId, transportId, dtlsParameters }, callback) => {
        try {
            const room = getRoom(roomId);
            if (!room) throw new Error('Room not found');
            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');
            const transport = peer.transports.find((t: Transport) => t.id === transportId);
            if (!transport) throw new Error('Transport not found');
            await transport.connect({ dtlsParameters });
            callback({ success: true });
        } catch (err) {
            console.error('connect-transport error', err);
            callback({ error: (err as Error).message || 'connect transport failed' });
        }
    });

    socket.on('produce', async ({ roomId, transportId, kind, rtpParameters, appData }, callback) => {
        try {
            const room = getRoom(roomId);
            if (!room) throw new Error('Room not found');
            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');
            const transport = peer.transports.find((t: Transport) => t.id === transportId);
            if (!transport) throw new Error('Transport not found');

            if (appData?.source === 'screen' && peer.role !== 'mentor') {
                return callback({ error: 'Only mentor can share screen' });
            }

            const producer: Producer = await transport.produce({ kind, rtpParameters, appData: { ...appData, peerId: user.info.uuid } });
            peer.producers.push(producer);

            socket.to(roomId).emit('new-producer', {
                producerId: producer.id,
                kind,
                peerId: user.info.uuid,
                appData: producer.appData,
                name: user.info.name,
                role: peer.role,
            });

            callback({ id: producer.id });
        } catch (err) {
            console.error('produce error', err);
            callback({ error: (err as Error).message || 'produce failed' });
        }
    });

    socket.on('consume', async ({ roomId, transportId, producerId, rtpCapabilities }, callback) => {
        try {
            const room = getRoom(roomId);
            if (!room) throw new Error('Room not found');
            const router = room.router;
            if (!router.canConsume({ producerId, rtpCapabilities })) {
                return callback({ error: 'Cannot consume' });
            }

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');
            const transport = peer.transports.find((t: Transport) => t.id === transportId);
            if (!transport) throw new Error('Transport not found');

            const consumer = await transport.consume({
                producerId,
                rtpCapabilities,
                paused: false,
            });

            peer.consumers.push(consumer);

            callback({
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                appData: consumer.appData,
            });
        } catch (err) {
            console.error('consume error', err);
            callback({ error: (err as Error).message || 'consume failed' });
        }
    });


    socket.on('toggle-producer', async ({ roomId, producerId, action }, callback) => {
        try {
            const room = getRoom(roomId);
            if (!room) throw new Error('Room not found');
            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');
            const producer = peer.producers.find((p: Producer) => p.id === producerId);
            if (!producer) throw new Error('Producer not found');

            if (action === 'pause') await producer.pause();
            else if (action === 'resume') await producer.resume();
            else throw new Error('Invalid action');


            io.to(roomId).emit('peer-media-status', {
                peerId: user.info.uuid,
                producerId,
                kind: producer.kind,
                action,
                name: user.info.name,
                role: peer.role
            });

            callback({ success: true });
        } catch (err) {
            console.error('toggle-producer error', err);
            callback({ error: (err as Error).message || 'toggle failed' });
        }
    });

    socket.on('get-existing-producers', ({ roomId }, callback) => {
        try {
            const room = getRoom(roomId);
            if (!room) return callback({ producers: [] });
            const producers: any[] = [];
            room.peers.forEach((peer) => {
                peer.producers
                    .filter((p: Producer) => !p.closed)
                    .forEach((p: Producer) => {
                        producers.push({
                            id: p.id,
                            kind: p.kind,
                            peerId: peer.peerId,
                            appData: p.appData,
                        });
                    });
            });
            callback({ producers });
        } catch (err) {
            console.error('get-existing-producers error', err);
            callback({ producers: [], error: (err as Error).message || 'error' });
        }
    });

    socket.on('leave-call', ({ roomId }, callback) => {
        try {
            const room = getRoom(roomId);
            if (!room) return callback?.({ error: 'Room not found' });
            const peer = room.peers.get(user.info.uuid);
            if (!peer) return callback?.({ error: 'Peer not found' });

            peer.producers.forEach((p: Producer) => {
                try {
                    p.close();
                    io.to(roomId).emit('producer-closed', { producerId: p.id, peerId: peer.peerId });
                } catch (e) { console.error(e); }
            });
            peer.producers = [];

            peer.consumers.forEach((c: Consumer) => { try { c.close(); } catch { } });
            peer.consumers = [];
            peer.transports.forEach((t: Transport) => { try { t.close(); } catch { } });
            peer.transports = [];

            room.peers.delete(user.info.uuid);
            socket.to(roomId).emit('peer-left', { peerId: user.info.uuid, name: user.info.name });
            socket.leave(roomId);

            if (room.peers.size === 0) {
                (global as any).rooms?.delete(roomId);
            }

            emitParticipants(roomId);
            callback?.({ success: true });
        } catch (err) {
            console.error('leave-call error', err);
            callback?.({ success: false, error: (err as Error).message || 'error' });
        }
    });

    socket.on('disconnect', () => {
        try {
            const roomId = (socket as any)._roomId;
            const uid = user.info.uuid;
            if (!roomId) return;
            const room = getRoom(roomId);
            if (!room) return;
            room.peers.delete(uid);
            socket.to(roomId).emit('peer-left', { peerId: uid, name: user.info.name });
            emitParticipants(roomId);
            socket.leave(roomId);
        } catch (err) {
            console.error('disconnect cleanup error', err);
        }
    });
};
