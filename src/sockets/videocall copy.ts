import { Server, Socket } from 'socket.io';
import { MediaKind, Worker } from 'mediasoup/node/lib/types';
import { createVideoRoomWithBalancedWorker } from '../mediasoup/createVideoRoomWithBalancedWorker';
import { addPeerToVideoRoom, getVideoRoom } from '../mediasoup/videocallRoomManager';

export const videocallSocketHandlerNew = (
    io: Server,
    socket: Socket,
    workers: Worker[]
) => {
    const user = (socket as any).user;
    if (!user) {
        console.warn('[VC] Unauthorized socket tried to connect', { socketId: socket.id });
        return socket.emit('vc-error', { message: 'Unauthorized' });
    }

    console.log('[VC] Handler attached', { socketId: socket.id, userId: user?.info?.uuid, role: user?.role });

    // Join one-to-one call
    socket.on('vc-join', async ({ callId }: { callId: string }, callback: (response: { success: boolean; error?: string }) => void) => {
        console.log('[VC] vc-join received', { callId, socketId: socket.id, userId: user.info.uuid, role: user.role });
        try {
            const room = await createVideoRoomWithBalancedWorker(callId, workers);
            addPeerToVideoRoom(callId, user.info.uuid, socket.id, user.info.name, user.role);
            (socket as any)._vcCallId = callId;
            socket.join(callId);

            if (room && room.router && room.router.rtpCapabilities) {
                console.log('[VC] Emitting router rtp capabilities', { callId });
                socket.emit('vc-router-rtp-capabilities', room.router.rtpCapabilities);
            } else {
                console.error('[VC] Missing room/router/rtpCapabilities', { callId });
                socket.emit('vc-error', { message: 'Room or router not available' });
            }

            callback({ success: true });
        } catch (err) {
            console.error('[VC] vc-join error', { callId, err });
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback({ success: false, error: errorMessage });
        }
    });

    // Create transport
    // socket.on('vc-create-transport', async ({ callId }, callback) => {
    //     console.log('[VC] vc-create-transport received', { callId, socketId: socket.id, userId: user.info.uuid });
    //     try {
    //         const room = getVideoRoom(callId);
    //         if (!room) throw new Error('Room not found');

    //         const transport = await room.router.createWebRtcTransport({
    //             listenIps: [{ ip: '0.0.0.0', announcedIp: '34.100.199.108' }],
    //             enableUdp: true,
    //             enableTcp: true,
    //             preferUdp: true,
    //         });

    //         const peer = room.peers.get(user.info.uuid);
    //         peer?.transports.push(transport);

    //         console.log('[VC] Transport created', { callId, transportId: transport.id });
    //         callback({
    //             id: transport.id,
    //             iceParameters: transport.iceParameters,
    //             iceCandidates: transport.iceCandidates,
    //             dtlsParameters: transport.dtlsParameters,
    //         });
    //     } catch (err) {
    //         console.error('[VC] vc-create-transport error', { callId, err });
    //         callback({ error: 'create-transport failed' });
    //     }
    // });
    socket.on('vc-create-transport', async ({ callId, direction }, callback) => {
        console.log('[VC] vc-create-transport received', { callId, direction, socketId: socket.id, userId: user.info.uuid });
        try {
            const room = getVideoRoom(callId);
            if (!room) throw new Error('Room not found');

            const transport = await room.router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedIp: '34.100.199.108' }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');

            // Store transport with direction info
            if (direction === 'send') {
                peer.sendTransport = transport;
            } else if (direction === 'recv') {
                peer.recvTransport = transport;
            }

            // Also keep the old array for backward compatibility
            peer.transports.push(transport);

            console.log('[VC] Transport created', { callId, transportId: transport.id, direction });
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (err) {
            console.error('[VC] vc-create-transport error', { callId, direction, err });
            callback({ error: 'create-transport failed' });
        }
    });

    // Connect transport
    socket.on('vc-connect-transport', async ({ callId, transportId, dtlsParameters }, callback) => {
        console.log('[VC] vc-connect-transport received', { callId, transportId, socketId: socket.id, userId: user.info.uuid });
        try {
            const room = getVideoRoom(callId);
            if (!room) throw new Error('Room not found');

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');

            const transport = peer.transports.find(t => t.id === transportId);
            if (!transport) throw new Error('Transport not found');

            await transport.connect({ dtlsParameters });
            console.log('[VC] Transport connected', { callId, transportId });
            callback({});
        } catch (err) {
            console.error('[VC] vc-connect-transport error', { callId, transportId, err });
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback({ error: errorMessage });
        }
    });

    // Produce media (audio/video/screen)
    // socket.on('vc-produce', async ({ callId, transportId, kind, rtpParameters, appData }, callback) => {
    //     console.log('[VC] vc-produce received', { callId, transportId, kind, source: appData?.source, userId: user.info.uuid, role: user.role });
    //     try {
    //         const room = getVideoRoom(callId);
    //         if (!room) throw new Error('Room not found');

    //         const peer = room.peers.get(user.info.uuid);
    //         if (!peer) throw new Error('Peer not found');

    //         const source = appData?.source;
    //         if (!source) return callback({ error: 'Missing appData.source' });

    //         // mentor-only screenshare
    //         if (source === 'screen' && user.role !== 'mentor') {
    //             return callback({ error: 'Only mentor can share screen' });
    //         }

    //         const transport = peer.transports.find(t => t.id === transportId);
    //         if (!transport) throw new Error('Transport not found');

    //         // Close existing producer of same kind/source
    //         const existingProducer = peer.producers.find(p => p.kind === kind && p.appData?.source === source);
    //         if (existingProducer) {
    //             existingProducer.close();
    //             peer.producers = peer.producers.filter(p => p.id !== existingProducer.id);
    //             console.log('[VC] Closed existing producer', { callId, existingProducerId: existingProducer.id, kind, source });
    //             socket.to(callId).emit('vc-producer-closed', {
    //                 producerId: existingProducer.id,
    //                 peerId: user.info.uuid,
    //                 kind: existingProducer.kind,
    //                 source: existingProducer.appData?.source
    //             });
    //         }

    //         const producer = await transport.produce({
    //             kind,
    //             rtpParameters,
    //             appData: { source, role: user.role },
    //         });
    //         peer.producers.push(producer);

    //         console.log('[VC] New producer started', { callId, producerId: producer.id, kind, source });
    //         socket.to(callId).emit('vc-new-producer', {
    //             producerId: producer.id,
    //             kind,
    //             peerId: user.info.uuid,
    //             appData: producer.appData,
    //             isTeacher: user.role === 'mentor',
    //             name: user.info.name,
    //         });

    //         callback({ id: producer.id });
    //     } catch (err) {
    //         console.error('[VC] vc-produce error', { callId, transportId, kind, source: appData?.source, err });
    //         const errorMessage = err instanceof Error ? err.message : String(err);
    //         callback({ error: errorMessage });
    //     }
    // });
    socket.on('vc-produce', async ({ callId, transportId, kind, rtpParameters, appData }, callback) => {
        console.log('[VC] vc-produce received', { callId, transportId, kind, source: appData?.source, userId: user.info.uuid, role: user.role });
        try {
            const room = getVideoRoom(callId);
            if (!room) throw new Error('Room not found');

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');

            const source = appData?.source;
            if (!source) return callback({ error: 'Missing appData.source' });

            // mentor-only screenshare
            if (source === 'screen' && user.role !== 'mentor') {
                return callback({ error: 'Only mentor can share screen' });
            }

            // Use sendTransport directly instead of finding by ID
            const transport = peer.sendTransport;
            if (!transport) throw new Error('Send transport not found');

            // Close existing producer of same kind/source
            const existingProducer = peer.producers.find(p => p.kind === kind && p.appData?.source === source);
            if (existingProducer) {
                existingProducer.close();
                peer.producers = peer.producers.filter(p => p.id !== existingProducer.id);
                console.log('[VC] Closed existing producer', { callId, existingProducerId: existingProducer.id, kind, source });
                socket.to(callId).emit('vc-producer-closed', {
                    producerId: existingProducer.id,
                    peerId: user.info.uuid,
                    kind: existingProducer.kind,
                    source: existingProducer.appData?.source
                });
            }

            const producer = await transport.produce({
                kind,
                rtpParameters,
                appData: { source, role: user.role },
            });
            peer.producers.push(producer);

            console.log('[VC] New producer started', { callId, producerId: producer.id, kind, source });
            socket.to(callId).emit('vc-new-producer', {
                producerId: producer.id,
                kind,
                peerId: user.info.uuid,
                appData: producer.appData,
                isTeacher: user.role === 'mentor',
                name: user.info.name,
            });

            callback({ id: producer.id });
        } catch (err) {
            console.error('[VC] vc-produce error', { callId, transportId, kind, source: appData?.source, err });
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback({ error: errorMessage });
        }
    });

    // Close producer broadcast (utility)
    socket.on('vc-producer-closed', ({ callId, producerId, peerId, kind, source }) => {
        console.log('[VC] vc-producer-closed broadcast', { callId, producerId, peerId, kind, source });
        socket.to(callId).emit('vc-producer-closed', { producerId, peerId, kind, source });
    });

    // Consume
    // socket.on('vc-consume', async ({ callId, transportId, producerId, rtpCapabilities }, callback) => {
    //     console.log('[VC] vc-consume received', { callId, transportId, producerId, socketId: socket.id });
    //     try {
    //         const room = getVideoRoom(callId);
    //         if (!room) throw new Error('Room not found');

    //         const peer = room.peers.get(user.info.uuid);
    //         if (!peer) throw new Error('Peer not found');

    //         const transport = peer.transports.find(t => t.id === transportId);
    //         if (!transport) throw new Error('Transport not found');

    //         const router = room.router;
    //         if (!router.canConsume({ producerId, rtpCapabilities })) {
    //             throw new Error('Cannot consume this producer');
    //         }

    //         const consumer = await transport.consume({
    //             producerId,
    //             rtpCapabilities,
    //             paused: true,
    //         });
    //         peer.consumers.push(consumer);

    //         await consumer.resume();
    //         console.log('[VC] Consumer created and resumed', { callId, consumerId: consumer.id, producerId });

    //         callback({
    //             id: consumer.id,
    //             producerId,
    //             kind: consumer.kind,
    //             rtpParameters: consumer.rtpParameters,
    //             appData: consumer.appData,
    //         });
    //     } catch (err) {
    //         console.error('[VC] vc-consume error', { callId, transportId, producerId, err });
    //         const errorMessage = err instanceof Error ? err.message : String(err);
    //         callback({ error: errorMessage });
    //     }
    // });

    socket.on('vc-consume', async ({ callId, transportId, producerId, rtpCapabilities }, callback) => {
        console.log('[VC] vc-consume received', { callId, transportId, producerId, socketId: socket.id });
        try {
            const room = getVideoRoom(callId);
            if (!room) throw new Error('Room not found');

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');

            // Use recvTransport directly instead of finding by ID
            const transport = peer.recvTransport;
            if (!transport) throw new Error('Receive transport not found');

            const router = room.router;
            if (!router.canConsume({ producerId, rtpCapabilities })) {
                throw new Error('Cannot consume this producer');
            }

            const consumer = await transport.consume({
                producerId,
                rtpCapabilities,
                paused: true,
            });
            peer.consumers.push(consumer);

            await consumer.resume();
            console.log('[VC] Consumer created and resumed', { callId, consumerId: consumer.id, producerId });

            callback({
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                appData: consumer.appData,
            });
        } catch (err) {
            console.error('[VC] vc-consume error', { callId, transportId, producerId, err });
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback({ error: errorMessage });
        }
    });

    // Get existing producers
    socket.on('vc-get-existing-producers', ({ callId }, callback: (resp: { producers: { id: string; kind: MediaKind; peerId: string; source: string; isTeacher: boolean }[], error?: string }) => void) => {
        console.log('[VC] vc-get-existing-producers received', { callId, socketId: socket.id });
        try {
            const room = getVideoRoom(callId);
            if (!room) throw new Error('Room not found');

            const producers: { id: string; kind: MediaKind; peerId: string; source: string; isTeacher: boolean }[] = [];
            room.peers.forEach((peer, peerId) => {
                peer.producers
                    .filter(p => !p.closed)
                    .forEach((producer) => {
                        producers.push({
                            id: producer.id,
                            kind: producer.kind,
                            peerId,
                            source: (producer.appData?.source as string) || 'unknown',
                            isTeacher: (producer.appData?.role as string) === 'mentor'
                        });
                    });
            });

            console.log('[VC] Returning existing producers', { callId, count: producers.length });
            callback({ producers });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            callback({ producers: [], error: errorMessage });
        }
    });

    // Toggle producer pause/resume
    socket.on('vc-toggle-producer', async ({ callId, kind, source, action }, callback) => {
        console.log('[VC] vc-toggle-producer received', { callId, kind, source, action, userId: user.info.uuid });
        try {
            const room = getVideoRoom(callId);
            if (!room) throw new Error('Room not found');

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');

            // mentor-only screenshare guard
            if (source === 'screen' && user.role !== 'mentor') {
                return callback({ error: 'Only mentor can share screen' });
            }

            const producer = peer.producers.find(p => p.kind === kind && p.appData?.source === source);
            if (!producer) throw new Error('Producer not found');

            if (action === 'pause') await producer.pause();
            else if (action === 'resume') await producer.resume();
            else throw new Error('Invalid action');

            io.to(callId).emit('vc-peer-media-status', {
                peerId: user.info.uuid,
                kind,
                source,
                isPaused: action === 'pause',
            });

            console.log('[VC] Toggled producer', { callId, kind, source, action });
            callback({ success: true });
        } catch (err) {
            console.error('[VC] vc-toggle-producer error', { callId, kind, source, action, err });
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback({ error: errorMessage });
        }
    });

    // Leave call
    socket.on('vc-leave', ({ callId }, callback) => {
        console.log('[VC] vc-leave received', { callId, socketId: socket.id, userId: user.info.uuid });
        try {
            const room = getVideoRoom(callId);
            if (!room) return callback?.({ error: 'Room not found' });

            const peer = room.peers.get(user.info.uuid);
            if (!peer) return callback?.({ error: 'Peer not found' });

            // Close producers and notify
            peer.producers.forEach(p => {
                try {
                    p.close();
                    io.to(callId).emit('vc-producer-closed', {
                        producerId: p.id,
                        peerId: peer.peerId,
                        kind: p.kind,
                        source: p.appData?.source,
                    });
                } catch { }
            });
            peer.producers = [];

            // Close consumers and transports
            peer.consumers.forEach(c => { try { c.close(); } catch { } });
            peer.transports.forEach(t => { try { t.close(); } catch { } });

            // Remove peer and leave room
            room.peers.delete(user.info.uuid);
            socket.leave(callId);

            console.log('[VC] Peer left room', { callId, userId: user.info.uuid });
            callback?.({ success: true });
        } catch (err) {
            console.error('[VC] vc-leave error', { callId, err });
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback?.({ success: false, error: errorMessage });
        }
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
        try {
            const callId = (socket as any)._vcCallId;
            console.log('[VC] disconnect', { callId, socketId: socket.id, userId: user.info.uuid });
            if (!callId) return;

            const room = getVideoRoom(callId);
            if (!room) return;

            const peer = room.peers.get(user.info.uuid);
            if (!peer) return;

            peer.producers.forEach(p => {
                try {
                    p.close();
                    io.to(callId).emit('vc-producer-closed', {
                        producerId: p.id,
                        peerId: peer.peerId,
                        kind: p.kind,
                        source: p.appData?.source,
                    });
                } catch { }
            });
            peer.producers = [];

            peer.consumers.forEach(c => { try { c.close(); } catch { } });
            peer.transports.forEach(t => { try { t.close(); } catch { } });

            room.peers.delete(user.info.uuid);
            socket.leave(callId);
            console.log('[VC] Disconnect cleanup done', { callId, userId: user.info.uuid });
        } catch (err) {
            console.error('[VC] disconnect cleanup error', { err });
        }
    });
};


