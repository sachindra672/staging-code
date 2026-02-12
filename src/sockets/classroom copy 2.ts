import { Server, Socket } from 'socket.io';
import { MediaKind, Worker } from 'mediasoup/node/lib/types';
import { createRoomWithBalancedWorker, removeRoom } from '../mediasoup/createRoomWithBalancedWorker';
import { addPeerToRoom, getRoom } from '../mediasoup/roomManager';
import { setupChatHandlers } from './chatHandler';
import { startRecordingBridge, stopRecordingBridge } from '../mediasoup/recordingBridge';

type RecordingKind = "audio" | "video" | "screen";

export const classroomSocketHandler = (
    io: Server,
    socket: Socket,
    workers: Worker[]
) => {
    console.log({ io, socket, workers })
    const user = (socket as any).user;

    // console.log(`user reached classroom socket`, user);

    if (!user) {
        return socket.emit('error', { message: 'Unauthorized' });
    }

    const emitStudentList = (sessionId: string) => {
        const room = getRoom(sessionId);
        if (!room) return;

        console.log(`emit student called`, { sessionId, room })

        for (const [peerId, peer] of room.peers) {
            console.log(`Peer ${peerId}:`, peer);
        }

        const students = Array.from(room.peers.values())
            .filter(peer => peer.role === 'student')
            .map(peer => ({
                id: peer.peerId,
                name: peer.name,
                hasMediaControl: peer.hasMediaControl || false,
                socketId: peer.socketId
            }));

        console.log(`student list:`, { students })

        io.to(sessionId).emit('student-list-updated', students);
    };

    const emitStudentLeft = (sessionId: string, studentId: string) => {
        const room = getRoom(sessionId);
        if (!room) return;

        io.to(sessionId).emit('student-left', { studentId });
    };


    // Join classroom
    socket.on('join-classroom', async ({ sessionId }: { sessionId: string }, callback: (response: { success: boolean; hasMediaControl?: boolean; error?: string }) => void) => {
        try {
            // console.log(`join classroom called`, user);
            const room = await createRoomWithBalancedWorker(sessionId, workers);
            addPeerToRoom(sessionId, user.info.uuid, socket.id, user.info.name, user.role);
            socket.join(sessionId);


            if ((socket as any)._chatSessionId !== sessionId) {
                if ((socket as any)._chatCleanup) {
                    (socket as any)._chatCleanup(); 
                }

                const cleanup = setupChatHandlers(io, socket, sessionId);

                (socket as any)._chatSessionId = sessionId;
                (socket as any)._chatCleanup = cleanup;
            }
            if (room && room.router && room.router.rtpCapabilities) {
                socket.emit('router-rtp-capabilities', room.router.rtpCapabilities);

                if (user.role === 'mentor') {
                    if (room.pendingSpeakRequests) {
                        socket.emit(
                            'pending-speak-requests',
                            Array.from(room.pendingSpeakRequests.values())
                        );
                    }

                    const activeSpeakers = Array.from(room.peers.values())
                        .filter(peer => peer.hasMediaControl && peer.id !== user.info.uuid)
                        .map(peer => ({ studentId: peer.id, name: peer.name }));
                    console.log(`the list of the active speakers:`, { activeSpeakers });
                    socket.emit('active-speakers', activeSpeakers);
                }
            } else {
                socket.emit('error', { message: 'Room or router not available' });
            }
            emitStudentList(sessionId);

            if (!room) {
                return callback({
                    success: false,
                    error: 'Room not found',
                });
            }
            const peer = room.peers.get(user.info.uuid);
            callback({
                success: true,
                hasMediaControl: peer?.hasMediaControl || false,
            });
        } catch (err) {
            console.error('join-classroom error:', err);
            socket.emit('error', { message: 'join-classroom failed' });
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback({ success: false, error: errorMessage });
        }
    });

    // Handle transport creation
    socket.on('create-transport', async ({ sessionId }, callback) => {
        try {
            const room = getRoom(sessionId);
            if (!room) throw new Error('Room not found');
            const router = room.router;

            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedIp: '34.100.199.108' }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            // console.log('ICE Candidates:', transport.iceParameters);
            // console.log('ICE Candidates:', transport.iceCandidates);

            const peer = room.peers.get(user.info.uuid);
            peer?.transports.push(transport);

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (err) {
            console.error('create-transport error', err);
            callback({ error: 'create-transport failed' });
        }
    });

    // Handle transport connection
    socket.on('connect-transport', async ({ transportId, dtlsParameters, sessionId }, callback) => {
        try {
            const room = getRoom(sessionId);
            if (!room) throw new Error('Room not found');

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');

            const transport = peer.transports.find(t => t.id === transportId);
            if (!transport) throw new Error('Transport not found');

            await transport.connect({ dtlsParameters });

            callback({}); // Success
        } catch (err) {
            console.error('connect-transport error', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback({ error: errorMessage });
        }
    });

    // Handle media production (audio/video/screen sharing)
    socket.on('produce', async ({ sessionId, transportId, kind, rtpParameters, appData }, callback) => {
        // console.log('produce event received:', { sessionId, transportId, kind, rtpParameters });
        try {
            // console.warn(`the user the one who is producing is`, user, `with the role`, user.role);
            const room = getRoom(sessionId);
            if (!room) throw new Error('Room not found');

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');

            if (user.role !== 'mentor' && !peer.hasMediaControl) {
                return callback({ error: 'Not authorized to use mic/cam' });
            }

            const transport = peer.transports.find(t => t.id === transportId);
            if (!transport) throw new Error('Transport not found');

            const source = appData?.source;
            if (!source) {
                return callback({ error: 'Missing appData.source' });
            }


            // Close existing producer of same kind
            const existingProducer = peer.producers.find(p =>
                p.kind === kind && p.appData?.source === appData?.source
            );

            if (existingProducer) {
                existingProducer.close();
                peer.producers = peer.producers.filter(p => p.id !== existingProducer.id);

                // Notify clients to remove old stream
                socket.to(sessionId).emit('producer-closed', {
                    producerId: existingProducer.id,
                    peerId: user.info.uuid,
                    kind: existingProducer.kind,
                    source: existingProducer.appData?.source
                });
            }

            // Create new producer
            const producer = await transport.produce({
                kind,
                rtpParameters,
                appData: { source: appData?.source || 'default', role: user.role },
            });
            peer.producers.push(producer);

            if (user.role === "mentor") {
                let recordingKind: RecordingKind;

                if (kind === "audio") {
                    recordingKind = "audio";
                } else if (kind === "video") {
                    const source = appData?.source;

                    if (source === "screen" || source === "presentation") {
                        recordingKind = "screen";
                    } else {
                        recordingKind = "video"; // camera video
                    }
                } else {
                    return callback({ error: "Unknown media kind" });
                }

                console.log(`✅ Mentor produced ${kind} (${appData?.source}). Recording as ${recordingKind}`);
                await startRecordingBridge(sessionId, recordingKind);
            }

            // Notify others (students) of new producer
            socket.to(sessionId).emit('new-producer', { producerId: producer.id, kind, peerId: user.info.uuid, appData: producer.appData, isTeacher: user.role === 'mentor', name: user.info.name });

            callback({ id: producer.id });
        } catch (err) {
            console.error('produce error', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback({ error: errorMessage });
        }
    });

    // socket.on('producer-closed', ({ sessionId, producerId, peerId, kind, source }) => {
    //     socket.to(sessionId).emit('producer-closed', { producerId, peerId, kind, source });
    // });

    socket.on('producer-closed', async ({ sessionId, producerId, peerId, kind, source }) => {
        socket.to(sessionId).emit('producer-closed', { producerId, peerId, kind, source });

        try {
            const room = getRoom(sessionId);
            const peer = room.peers.get(peerId);

            if (peer?.role === "mentor") {
                let recordingKind: "audio" | "video" | "screen" | null = null;

                if (kind === "audio") recordingKind = "audio";
                else if (kind === "video" && source === "camera") recordingKind = "video";
                else if (kind === "video" && (source === "screen" || source === "presentation"))
                    recordingKind = "screen";

                if (recordingKind) {
                    await stopRecordingBridge(sessionId, { kind: recordingKind });
                    console.log(`Stopped recording of ${recordingKind}`);
                }
            }
        } catch (err) {
            console.error("producer-closed stop recording error:", err);
        }
    });


    // Consume a producer
    socket.on('consume', async ({ sessionId, transportId, producerId, rtpCapabilities }, callback) => {
        try {
            const room = getRoom(sessionId);
            if (!room) throw new Error('Room not found');

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');

            const transport = peer.transports.find(t => t.id === transportId);
            if (!transport) throw new Error('Transport not found');

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

            callback({
                id: consumer.id,
                producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                appData: consumer.appData,
            });
        } catch (err) {
            console.error('consume error', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback({ error: errorMessage });
        }
    });

    // get existing producers in the room (usefull when student join or reconnect)
    socket.on('get-existing-producers', ({ sessionId }, callback) => {
        try {
            // console.log(`producer get called`, { sessionId })
            const room = getRoom(sessionId);
            if (!room) throw new Error('Room not found');

            // console.log(`room for user ${user}`, { "peers": room.peers });

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

            // console.log(`producers found`, { producers })

            callback?.({ producers });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            callback?.({ producers: [], error: errorMessage });
        }
    });

    // toggle producer pause/resume (video/audio)
    socket.on('toggle-producer', async ({ sessionId, kind, source, action }, callback) => {
        try {
            const room = getRoom(sessionId);
            if (!room) throw new Error('Room not found');

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error('Peer not found');

            if (user.role !== 'mentor' && !peer.hasMediaControl) {
                return callback({ error: 'Not authorized to use mic/cam' });
            }

            const producer = peer.producers.find(p => p.kind === kind && p.appData?.source === source);
            if (!producer) throw new Error('Producer not found');

            if (action === 'pause') await producer.pause();
            else if (action === 'resume') await producer.resume();
            else throw new Error('Invalid action');

            // Notify other peers (students)
            io.to(sessionId).emit('peer-media-status', {
                peerId: user.info.uuid,
                kind,
                isPaused: action === 'pause',
            });

            callback({ success: true });
        } catch (err) {
            console.error('toggle-producer error:', err);
            callback({ error: 'Toggle producer failed' });
        }
    });

    // Request to speak - from student to teacher
    socket.on('request-to-speak', ({ sessionId }, callback) => {
        const room = getRoom(sessionId);
        if (!room) return callback({ error: 'Room not found' });

        // Ensure pendingSpeakRequests map exists
        if (!room.pendingSpeakRequests) {
            room.pendingSpeakRequests = new Map();
        }

        // Check if student has already requested
        if (room.pendingSpeakRequests.has(user.info.uuid)) {
            return callback({ error: 'Already requested' });
        }

        // Add student to pending requests
        // console.log({ user })
        const requestData = {
            studentId: user.info.uuid,
            name: user.info.name,
        };

        room.pendingSpeakRequests.set(user.info.uuid, requestData);

        // Notify teacher
        io.to(sessionId).emit('speak-request', requestData);

        // Acknowledge request
        callback({ success: true });
    });

    // Approve speak request from teacher to student
    socket.on('approve-speak-request', ({ sessionId, studentId }, callback) => {
        const room = getRoom(sessionId);
        if (!room) return callback({ error: 'Room not found' });

        const peer = room.peers.get(studentId);
        if (!peer) return callback({ error: 'Student not found' });

        peer.hasMediaControl = true;

        // Remove from pending requests
        if (room.pendingSpeakRequests) {
            room.pendingSpeakRequests.delete(studentId);
        }

        // Notify the student
        io.to(peer.socketId).emit('speak-request-approved');

        emitStudentList(sessionId);

        // Emit updated list of active speakers to everyone in the room
        io.to(sessionId).emit('active-speakers',
            Array.from(room.peers.entries())
                .filter(([_peerId, p]) => p.hasMediaControl)
                .map(([peerId, p]) => ({ studentId: peerId, name: p.name }))
        );

        callback({ success: true });
    });

    // Deny speak request from teacher to student
    socket.on('deny-speak-request', ({ sessionId, studentId }, callback) => {
        const room = getRoom(sessionId);
        if (!room) return callback({ error: 'Room not found' });

        const peer = room.peers.get(studentId);
        if (!peer) return callback({ error: 'Student not found' });

        // Remove from pending requests
        if (room.pendingSpeakRequests) {
            room.pendingSpeakRequests.delete(studentId);
        }

        // Notify the student
        io.to(peer.socketId).emit('speak-request-denied');

        // Emit updated active speakers list (in case they were previously approved)
        io.to(sessionId).emit('active-speakers',
            Array.from(room.peers.values())
                .filter(p => p.hasMediaControl)
                .map(p => ({ studentId: p.peerId, name: p.name }))
        );

        callback({ success: true });
    });

    // taking away speak permission from student
    // socket.on('revoke-speak', ({ sessionId, studentId }, callback) => {
    //     const room = getRoom(sessionId);
    //     if (!room) return callback({ error: 'Room not found' });

    //     const peer = room.peers.get(studentId);
    //     if (!peer) return callback({ error: 'Student not found' });

    //     // Remove media control
    //     peer.hasMediaControl = false;
    //     peer.producers.forEach(p => p.close());
    //     peer.producers = [];

    //     // Notify the student
    //     io.to(peer.socketId).emit('speak-revoked');

    //     // Update student list
    //     emitStudentList(sessionId);

    //     // Emit updated list of active speakers to everyone in the room
    //     io.to(sessionId).emit('active-speakers',
    //         Array.from(room.peers.entries())
    //             .filter(([_peerId, p]) => p.hasMediaControl)
    //             .map(([peerId, _p]) => ({ studentId: peerId }))
    //     );

    //     callback({ success: true });
    // });

    // taking away speak permission from student
    socket.on('revoke-speak', ({ sessionId, studentId }, callback) => {
        const room = getRoom(sessionId);
        if (!room) return callback({ error: 'Room not found' });

        const peer = room.peers.get(studentId);
        if (!peer) return callback({ error: 'Student not found' });

        // Remove media control
        peer.hasMediaControl = false;

        // --- Close only this student's producers ---
        peer.producers.forEach(p => {
            try {
                p.close();
                io.to(sessionId).emit('producer-closed', {
                    producerId: p.id,
                    peerId: peer.peerId,
                    kind: p.kind,
                    source: p.appData?.source,
                });
            } catch (err) {
                console.error('Error closing producer:', err);
            }
        });
        peer.producers = [];


        // Notify the student
        io.to(peer.socketId).emit('speak-revoked');

        // Update student list
        emitStudentList(sessionId);

        // Emit updated list of active speakers to everyone in the room
        io.to(sessionId).emit('active-speakers',
            Array.from(room.peers.entries())
                .filter(([_peerId, p]) => p.hasMediaControl)
                .map(([peerId, p]) => ({ studentId: peerId, name: p.name }))
        );

        callback({ success: true });
    });


    // taking away speak permission from student
    // socket.on('revoke-speak', ({ sessionId, studentId }, callback) => {
    //     const room = getRoom(sessionId);
    //     if (!room) return callback({ error: 'Room not found' });

    //     const peer = room.peers.get(studentId);
    //     if (!peer) return callback({ error: 'Student not found' });

    //     // Remove media control
    //     peer.hasMediaControl = false;

    //     // --- Close and notify producers ---
    //     peer.producers.forEach(p => {
    //         try {
    //             p.close();
    //             io.to(sessionId).emit('producer-closed', {
    //                 producerId: p.id,
    //                 peerId: peer.peerId,
    //                 kind: p.kind,
    //                 source: p.appData?.source,
    //             });
    //         } catch (err) {
    //             console.error('Error closing producer:', err);
    //         }
    //     });
    //     peer.producers = [];

    //     // --- Close all consumers (ghost tracks cleanup) ---
    //     peer.consumers.forEach(c => {
    //         try { c.close(); } catch (err) {
    //             console.error('Error closing consumer:', err);
    //         }
    //     });
    //     peer.consumers = [];

    //     // Notify the student
    //     io.to(peer.socketId).emit('speak-revoked');

    //     // Update student list
    //     emitStudentList(sessionId);

    //     // Emit updated list of active speakers to everyone in the room
    //     io.to(sessionId).emit('active-speakers',
    //         Array.from(room.peers.entries())
    //             .filter(([_peerId, p]) => p.hasMediaControl)
    //             .map(([peerId, _p]) => ({ studentId: peerId }))
    //     );

    //     callback({ success: true });
    // });


    // student reconnecting to classroom - (only speak permission handled here yet)
    // socket.on('reconnect-to-classroom', ({ sessionId }, callback) => {
    //     const room = getRoom(sessionId);
    //     if (!room) return callback({ error: 'Room not found' });

    //     const peer = room.peers.get(user.info.uuid);
    //     if (!peer) return callback({ error: 'Peer not found' });
    //     peer.socketId = socket.id;
    //     socket.join(sessionId);

    //     const hasPendingRequest = room.pendingSpeakRequests.has(user.info.uuid);
    //     callback({ hasPendingRequest, hasMediaControl: peer.hasMediaControl });
    // });

    socket.on('stop-recording', async ({ sessionId }, callback) => {
        try {
            console.log(`Stop recording requested for session: ${sessionId}`);

            if (!sessionId) {
                console.log(`stop not session id`);
                if (callback) callback({ success: false, error: 'sessionId is required' });
                return;
            }

            await stopRecordingBridge(sessionId);

            console.log(`Recording stopped for session: ${sessionId}`);

            if (callback) callback({ success: true });
        } catch (error) {
            console.error(`Failed to stop recording for session ${sessionId}:`, error);

            if (callback) callback({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
    });


    socket.on('leave-classroom', ({ sessionId }, callback) => {
        try {
            // --- Cleanup chat handlers if any ---
            if ((socket as any)._chatCleanup) {
                (socket as any)._chatCleanup();
                (socket as any)._chatCleanup = null;
            }
            (socket as any)._chatSessionId = null;

            const room = getRoom(sessionId);
            if (!room) return callback?.({ error: 'Room not found' });

            const peer = room.peers.get(user.info.uuid);
            if (!peer) return callback?.({ error: 'Peer not found' });

            // ✅ If peer had speak permission → revoke before removing
            if (peer.hasMediaControl) {
                peer.hasMediaControl = false;

                // Close their producers and notify
                peer.producers.forEach(p => {
                    try {
                        p.close();
                        io.to(sessionId).emit('producer-closed', {
                            producerId: p.id,
                            peerId: peer.peerId,
                            kind: p.kind,
                            source: p.appData?.source,
                        });
                    } catch (err) {
                        console.error('Error closing producer:', err);
                    }
                });
                peer.producers = [];

                // Emit updated active speaker list
                io.to(sessionId).emit(
                    'active-speakers',
                    Array.from(room.peers.values())
                        .filter(p => p.hasMediaControl)
                        .map(p => ({ studentId: p.peerId, name: p.name }))
                );
            }

            // --- Cleanup: close transports & consumers
            peer.consumers.forEach(c => { try { c.close(); } catch { } });
            peer.transports.forEach(t => { try { t.close(); } catch { } });

            // Remove peer from room
            room.peers.delete(user.info.uuid);

            // Remove from pending requests if present
            if (room.pendingSpeakRequests?.has(user.info.uuid)) {
                room.pendingSpeakRequests.delete(user.info.uuid);
            }

            // Notify others if student left
            if (user.role === 'student') {
                emitStudentLeft(sessionId, user.info.uuid);
            }

            // Update student list for everyone
            emitStudentList(sessionId);

            // Leave the socket.io room
            socket.leave(sessionId);

            callback?.({ success: true });
        } catch (err) {
            console.error('leave-classroom error:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback?.({ success: false, error: errorMessage });
        }
    });



    socket.on('end-class', async ({ sessionId }, callback) => {
        try {
           
            const room = getRoom(sessionId);
            if (!room) return callback?.({ error: 'Room not found' });

            if (user.role !== 'mentor') {
                return callback?.({ error: 'Only teacher can end the class' });
            }

            for (const [_peerId, peer] of room.peers.entries()) {
                // revoke speak if any
                if (peer.hasMediaControl) {
                    peer.hasMediaControl = false;
                }

                // close producers
                peer.producers.forEach(p => {
                    try {
                        p.close();
                        io.to(sessionId).emit('producer-closed', {
                            producerId: p.id,
                            peerId: peer.peerId,
                            kind: p.kind,
                            source: p.appData?.source,
                        });
                    } catch (err) {
                        console.error('Error closing producer:', err);
                    }
                });
                peer.producers = [];

                // close consumers
                peer.consumers.forEach(c => {
                    try { c.close(); } catch { }
                });
                peer.consumers = [];

                // close transports
                peer.transports.forEach(t => {
                    try { t.close(); } catch { }
                });
                peer.transports = [];
            }

            // --- Clear all peers & pending requests ---
            room.peers.clear();
            if (room.pendingSpeakRequests) {
                room.pendingSpeakRequests.clear();
            }

            removeRoom(sessionId);


            // --- Notify all in this classroom ---
            io.to(sessionId).emit('class-ended', { sessionId });

            // --- Make all sockets leave socket.io room ---
            io.in(sessionId).socketsLeave(sessionId);

            // // --- Optionally cleanup global room object ---
            // (global as any).rooms?.delete(sessionId);

            callback?.({ success: true });
        } catch (err) {
            console.error('end-class error:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback?.({ success: false, error: errorMessage });
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);

        // Find which session this socket was in
        const sessionId = (socket as any)._chatSessionId;
        if (!sessionId) return;

        const room = getRoom(sessionId);
        if (!room) return;

        const peer = room.peers.get(user.info.uuid);
        if (!peer) return;

        try {
            // ✅ Reuse leave-classroom cleanup
            // Revoke speak permission if active
            if (peer.hasMediaControl) {
                peer.hasMediaControl = false;

                peer.producers.forEach(p => {
                    try {
                        p.close();
                        io.to(sessionId).emit('producer-closed', {
                            producerId: p.id,
                            peerId: peer.peerId,
                            kind: p.kind,
                            source: p.appData?.source,
                        });
                    } catch (err) {
                        console.error('Error closing producer:', err);
                    }
                });
                peer.producers = [];

                io.to(sessionId).emit(
                    'active-speakers',
                    Array.from(room.peers.values())
                        .filter(p => p.hasMediaControl)
                        .map(p => ({ studentId: p.peerId, name: p.name }))
                );
            }

            // Close consumers and transports
            peer.consumers.forEach(c => { try { c.close(); } catch { } });
            peer.transports.forEach(t => { try { t.close(); } catch { } });

            // Remove peer
            room.peers.delete(user.info.uuid);

            // Remove from pending requests
            if (room.pendingSpeakRequests?.has(user.info.uuid)) {
                room.pendingSpeakRequests.delete(user.info.uuid);
            }

            // Notify others if student left
            if (user.role === 'student') {
                io.to(sessionId).emit('student-left', { studentId: user.info.uuid });
            }

            // Update student list
            io.to(sessionId).emit(
                'student-list-updated',
                Array.from(room.peers.values())
                    .filter(p => p.role === 'student')
                    .map(p => ({
                        id: p.peerId,
                        name: p.name,
                        hasMediaControl: p.hasMediaControl || false,
                        socketId: p.socketId,
                    }))
            );

        } catch (err) {
            console.error('disconnect cleanup error:', err);
        }
    });


};




// create socket for the disconnect there emitStudentLeft(sessionId, user.id); also emitStudentList(sessionId);

// socket.on('disconnect', () => {
//     // Loop through all rooms to find where the user was present
//     for (const [sessionId, room] of (global as any).rooms || []) {
//         if (room.peers.has(user.id)) {
//             room.peers.delete(user.id);

//             // Notify that this student left
//             if (user.role === 'STUDENT') {
//                 emitStudentLeft(sessionId, user.id);
//             }

//             // Update the list for everyone
//             emitStudentList(sessionId);
//         }
//     }
// });