// // src/classroom.ts
// import { Server, Socket } from 'socket.io';
// import { MediaKind, Worker } from 'mediasoup/node/lib/types';
// import { createRoomWithBalancedWorker, removeRoom } from '../mediasoup/createRoomWithBalancedWorker';
// import { addPeerToRoom, getRoom } from '../mediasoup/roomManager';
// import { setupChatHandlers } from './chatHandler';
// import {
//   clearGraceTimer,
//   graceTimers,
//   startRecordingBridge,
//   stopRecordingBridge,
//   timerKey
// } from '../mediasoup/recordingBridge';

// type RecordingKind = "audio" | "video" | "screen";

// export const classroomSocketHandler = (
//   io: Server,
//   socket: Socket,
//   workers: Worker[]
// ) => {
//   console.log('classroomSocketHandler init', { socketId: socket.id });
//   const user = (socket as any).user;

//   if (!user) {
//     return socket.emit('error', { message: 'Unauthorized' });
//   }

//   const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || process.env.RECORDER_VM_IP || '0.0.0.0';

//   const emitStudentList = (sessionId: string) => {
//     const room = getRoom(sessionId);
//     if (!room) return;

//     const students = Array.from(room.peers.values())
//       .filter(peer => peer.role === 'student')
//       .map(peer => ({
//         id: peer.peerId,
//         name: peer.name,
//         hasMediaControl: peer.hasMediaControl || false,
//         socketId: peer.socketId
//       }));

//     io.to(sessionId).emit('student-list-updated', students);
//   };

//   const emitStudentLeft = (sessionId: string, studentId: string) => {
//     const room = getRoom(sessionId);
//     if (!room) return;
//     io.to(sessionId).emit('student-left', { studentId });
//   };

//   // Join classroom
//   socket.on('join-classroom', async ({ sessionId }: { sessionId: string }, callback: (response: { success: boolean; hasMediaControl?: boolean; error?: string }) => void) => {
//     try {
//       const room = await createRoomWithBalancedWorker(sessionId, workers);
//       addPeerToRoom(sessionId, user.info.uuid, socket.id, user.info.name, user.role);
//       socket.join(sessionId);

//       // Setup chat handlers for this socket/room
//       if ((socket as any)._chatSessionId !== sessionId) {
//         if ((socket as any)._chatCleanup) {
//           (socket as any)._chatCleanup();
//         }
//         const cleanup = setupChatHandlers(io, socket, sessionId);
//         (socket as any)._chatSessionId = sessionId;
//         (socket as any)._chatCleanup = cleanup;
//       }

//       if (room && room.router && room.router.rtpCapabilities) {
//         socket.emit('router-rtp-capabilities', room.router.rtpCapabilities);

//         if (user.role === 'mentor') {
//           if (room.pendingSpeakRequests) {
//             socket.emit(
//               'pending-speak-requests',
//               Array.from(room.pendingSpeakRequests.values())
//             );
//           }

//           const activeSpeakers = Array.from(room.peers.values())
//             .filter(peer => peer.hasMediaControl && peer.id !== user.info.uuid)
//             .map(peer => ({ studentId: peer.id, name: peer.name }));
//           socket.emit('active-speakers', activeSpeakers);
//         }
//       } else {
//         socket.emit('error', { message: 'Room or router not available' });
//       }

//       emitStudentList(sessionId);

//       if (!room) {
//         return callback({
//           success: false,
//           error: 'Room not found',
//         });
//       }

//       const peer = room.peers.get(user.info.uuid);
//       callback({
//         success: true,
//         hasMediaControl: peer?.hasMediaControl || false,
//       });

//     } catch (err) {
//       console.error('join-classroom error:', err);
//       socket.emit('error', { message: 'join-classroom failed' });
//       const errorMessage = err instanceof Error ? err.message : String(err);
//       callback({ success: false, error: errorMessage });
//     }
//   });

//   // Create transport
//   socket.on('create-transport', async ({ sessionId }, callback) => {
//     try {
//       const room = getRoom(sessionId);
//       if (!room) throw new Error('Room not found');
//       const router = room.router;

//       const transport = await router.createWebRtcTransport({
//         listenIps: [{ ip: '0.0.0.0', announcedIp }],
//         enableUdp: true,
//         enableTcp: true,
//         preferUdp: true,
//       });

//       const peer = room.peers.get(user.info.uuid);
//       peer?.transports.push(transport);

//       callback({
//         id: transport.id,
//         iceParameters: transport.iceParameters,
//         iceCandidates: transport.iceCandidates,
//         dtlsParameters: transport.dtlsParameters,
//       });
//     } catch (err) {
//       console.error('create-transport error', err);
//       callback({ error: 'create-transport failed' });
//     }
//   });

//   // Connect transport
//   socket.on('connect-transport', async ({ transportId, dtlsParameters, sessionId }, callback) => {
//     try {
//       const room = getRoom(sessionId);
//       if (!room) throw new Error('Room not found');

//       const peer = room.peers.get(user.info.uuid);
//       if (!peer) throw new Error('Peer not found');

//       const transport = peer.transports.find(t => t.id === transportId);
//       if (!transport) throw new Error('Transport not found');

//       await transport.connect({ dtlsParameters });

//       callback({});
//     } catch (err) {
//       console.error('connect-transport error', err);
//       const errorMessage = err instanceof Error ? err.message : String(err);
//       callback({ error: errorMessage });
//     }
//   });

//   // Produce media (audio/video/screen)
//   socket.on('produce', async ({ sessionId, transportId, kind, rtpParameters, appData }, callback) => {
//     try {
//       const room = getRoom(sessionId);
//       if (!room) throw new Error('Room not found');

//       const peer = room.peers.get(user.info.uuid);
//       if (!peer) throw new Error('Peer not found');

//       if (user.role !== 'mentor' && !peer.hasMediaControl) {
//         return callback({ error: 'Not authorized to use mic/cam' });
//       }

//       const transport = peer.transports.find(t => t.id === transportId);
//       if (!transport) throw new Error('Transport not found');

//       const source = appData?.source;
//       if (!source) {
//         return callback({ error: 'Missing appData.source' });
//       }

//       // Close existing producer of same kind+source
//       const existingProducer = peer.producers.find(p =>
//         p.kind === kind && p.appData?.source === appData?.source
//       );

//       if (existingProducer) {
//         console.log(`🔄 Closing existing producer ${existingProducer.id} (${existingProducer.kind}, source: ${existingProducer.appData?.source})`);

//         const oldSource = existingProducer.appData?.source;
//         const oldKind = existingProducer.kind;

//         if (user.role === "mentor") {
//           let oldRecordingKind: "audio" | "video" | "screen" | null = null;

//           if (oldKind === "audio") {
//             oldRecordingKind = "audio";
//           } else if (oldKind === "video") {
//             if (oldSource === "screen" || oldSource === "presentation") {
//               oldRecordingKind = "screen";
//             } else {
//               oldRecordingKind = "video";
//             }
//           }

//           if (oldRecordingKind) {
//             if (oldRecordingKind === "audio" || oldRecordingKind === "video") {
//               const key = `${sessionId}-${oldRecordingKind}`;
//               const existingTimer = graceTimers.get(key);

//               if (!existingTimer) {
//                 console.log(`⏳ Starting 90s grace period for ${sessionId} (${oldRecordingKind})`);
//                 const timeout = setTimeout(async () => {
//                   graceTimers.delete(key);
//                   console.log(`⌛ Grace period expired for ${sessionId} (${oldRecordingKind}), stopping recording`);
//                   try {
//                     await stopRecordingBridge(sessionId, {
//                       kind: oldRecordingKind,
//                       stoppedAt: Date.now()
//                     });
//                   } catch (err) {
//                     console.error('stopRecordingBridge error (grace timeout):', err);
//                   }
//                 }, 90_000);

//                 graceTimers.set(key, timeout);
//               } else {
//                 console.log(`ℹ️ Grace timer already active for ${sessionId} (${oldRecordingKind})`);
//               }
//             } else {
//               // Screen: stop immediately
//               console.log(`🛑 Stopping old recording (${oldRecordingKind}) before starting new one`);
//               try {
//                 await stopRecordingBridge(sessionId, {
//                   kind: oldRecordingKind,
//                   stoppedAt: Date.now()
//                 });
//               } catch (err) {
//                 console.error('stopRecordingBridge error (stop old screen):', err);
//               }
//             }
//           }
//         }

//         // Close existing producer
//         try {
//           existingProducer.close();
//         } catch (err) {
//           console.error('Error closing existing producer:', err);
//         }
//         peer.producers = peer.producers.filter(p => p.id !== existingProducer.id);

//         // Notify other peers (not the producer's socket)
//         socket.to(sessionId).emit('producer-closed', {
//           producerId: existingProducer.id,
//           peerId: user.info.uuid,
//           kind: existingProducer.kind,
//           source: existingProducer.appData?.source
//         });
//       }

//       // Create new producer
//       const producer = await transport.produce({
//         kind,
//         rtpParameters,
//         appData: { source: appData?.source || 'default', role: user.role },
//       });
//       peer.producers.push(producer);

//       // If mentor — start recording bridge
//       if (user.role === "mentor") {
//         let recordingKind: RecordingKind;

//         if (kind === "audio") {
//           recordingKind = "audio";
//         } else if (kind === "video") {
//           const src = appData?.source;
//           if (src === "screen" || src === "presentation") {
//             recordingKind = "screen";
//           } else {
//             recordingKind = "video";
//           }
//         } else {
//           return callback({ error: "Unknown media kind" });
//         }

//         console.log(`✅ Mentor produced ${kind} (${appData?.source}). Recording as ${recordingKind}`);

//         // Trigger the recording bridge. The bridge is expected to
//         // create the plain transport on the router and connect to Recorder VM.
//         // Calling it here ensures producer exists before bridge pipes it.
//         try {
//           await startRecordingBridge(sessionId, recordingKind);
//         } catch (err) {
//           console.error('startRecordingBridge error:', err);
//         }
//       }

//       // Notify other clients (students)
//       socket.to(sessionId).emit('new-producer', {
//         producerId: producer.id,
//         kind,
//         peerId: user.info.uuid,
//         appData: producer.appData,
//         isTeacher: user.role === 'mentor',
//         name: user.info.name
//       });

//       callback({ id: producer.id });
//     } catch (err) {
//       console.error('produce error', err);
//       const errorMessage = err instanceof Error ? err.message : String(err);
//       callback({ error: errorMessage });
//     }
//   });

//   // producer-closed handler (received from clients)
//   socket.on('producer-closed', async ({ sessionId, producerId, peerId, kind, source }) => {
//     socket.to(sessionId).emit('producer-closed', { producerId, peerId, kind, source });

//     try {
//       const room = getRoom(sessionId);
//       if (!room) {
//         console.warn(`Room not found for session ${sessionId} in producer-closed`);
//         return;
//       }
//       const peer = room.peers.get(peerId);
//       if (!peer) {
//         console.warn(`Peer ${peerId} not found in room ${sessionId}`);
//         return;
//       }

//       if (peer.role === "mentor") {
//         let recordingKind: "audio" | "video" | "screen" | null = null;

//         if (kind === "audio") {
//           recordingKind = "audio";
//         } else if (kind === "video") {
//           if (source === "screen" || source === "presentation") {
//             recordingKind = "screen";
//           } else {
//             recordingKind = "video";
//           }
//         }

//         if (recordingKind) {
//           if (recordingKind === "audio" || recordingKind === "video") {
//             const key = timerKey(sessionId, recordingKind);
//             const existingTimer = graceTimers.get(key);

//             if (!existingTimer) {
//               console.log(`⏳ Starting 90s grace period for ${sessionId} (${recordingKind})`);
//               const timeout = setTimeout(async () => {
//                 graceTimers.delete(key);
//                 console.log(`⌛ Grace period expired for ${sessionId} (${recordingKind}), stopping recording`);
//                 try {
//                   await stopRecordingBridge(sessionId, {
//                     kind: recordingKind,
//                     stoppedAt: Date.now()
//                   });
//                 } catch (err) {
//                   console.error('stopRecordingBridge error (grace timeout):', err);
//                 }
//               }, 90_000);

//               graceTimers.set(key, timeout);
//             }
//           } else {
//             // Screen: stop immediately
//             console.log(`🛑 Stopping recording for ${sessionId} (${recordingKind})...`);
//             try {
//               await stopRecordingBridge(sessionId, {
//                 kind: recordingKind,
//                 stoppedAt: Date.now()
//               });
//             } catch (err) {
//               console.error('stopRecordingBridge error (stop screen):', err);
//             }
//           }
//         } else {
//           console.log(`ℹ️ No recording to stop for producer ${producerId} (kind: ${kind}, source: ${source})`);
//         }
//       }
//     } catch (err) {
//       console.error("❌ producer-closed stop recording error:", err);
//     }
//   });

//   // consume a producer
//   socket.on('consume', async ({ sessionId, transportId, producerId, rtpCapabilities }, callback) => {
//     try {
//       const room = getRoom(sessionId);
//       if (!room) throw new Error('Room not found');

//       const peer = room.peers.get(user.info.uuid);
//       if (!peer) throw new Error('Peer not found');

//       const transport = peer.transports.find(t => t.id === transportId);
//       if (!transport) throw new Error('Transport not found');

//       const router = room.router;
//       if (!router.canConsume({ producerId, rtpCapabilities })) {
//         throw new Error('Cannot consume this producer');
//       }

//       const consumer = await transport.consume({
//         producerId,
//         rtpCapabilities,
//         paused: true,
//       });

//       peer.consumers.push(consumer);

//       await consumer.resume();

//       callback({
//         id: consumer.id,
//         producerId,
//         kind: consumer.kind,
//         rtpParameters: consumer.rtpParameters,
//         appData: consumer.appData,
//       });
//     } catch (err) {
//       console.error('consume error', err);
//       const errorMessage = err instanceof Error ? err.message : String(err);
//       callback({ error: errorMessage });
//     }
//   });

//   // get existing producers for a room
//   socket.on('get-existing-producers', ({ sessionId }, callback) => {
//     try {
//       const room = getRoom(sessionId);
//       if (!room) throw new Error('Room not found');

//       const producers: { id: string; kind: MediaKind; peerId: string; source: string; isTeacher: boolean }[] = [];
//       room.peers.forEach((peer, peerId) => {
//         peer.producers
//           .filter(p => !p.closed)
//           .forEach((producer) => {
//             producers.push({
//               id: producer.id,
//               kind: producer.kind,
//               peerId,
//               source: (producer.appData?.source as string) || 'unknown',
//               isTeacher: (producer.appData?.role as string) === 'mentor'
//             });
//           });
//       });

//       callback?.({ producers });
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : String(error);
//       callback?.({ producers: [], error: errorMessage });
//     }
//   });

//   // toggle producer pause/resume
//   socket.on('toggle-producer', async ({ sessionId, kind, source, action }, callback) => {
//     try {
//       const room = getRoom(sessionId);
//       if (!room) throw new Error('Room not found');

//       const peer = room.peers.get(user.info.uuid);
//       if (!peer) throw new Error('Peer not found');

//       if (user.role !== 'mentor' && !peer.hasMediaControl) {
//         return callback({ error: 'Not authorized to use mic/cam' });
//       }

//       const producer = peer.producers.find(p => p.kind === kind && p.appData?.source === source);
//       if (!producer) throw new Error('Producer not found');

//       if (action === 'pause') await producer.pause();
//       else if (action === 'resume') await producer.resume();
//       else throw new Error('Invalid action');

//       io.to(sessionId).emit('peer-media-status', {
//         peerId: user.info.uuid,
//         kind,
//         isPaused: action === 'pause',
//       });

//       callback({ success: true });
//     } catch (err) {
//       console.error('toggle-producer error:', err);
//       callback({ error: 'Toggle producer failed' });
//     }
//   });

//   // request to speak
//   socket.on('request-to-speak', ({ sessionId }, callback) => {
//     const room = getRoom(sessionId);
//     if (!room) return callback({ error: 'Room not found' });

//     if (!room.pendingSpeakRequests) {
//       room.pendingSpeakRequests = new Map();
//     }

//     if (room.pendingSpeakRequests.has(user.info.uuid)) {
//       return callback({ error: 'Already requested' });
//     }

//     const requestData = {
//       studentId: user.info.uuid,
//       name: user.info.name,
//     };

//     room.pendingSpeakRequests.set(user.info.uuid, requestData);

//     io.to(sessionId).emit('speak-request', requestData);

//     callback({ success: true });
//   });

//   // approve speak request
//   socket.on('approve-speak-request', ({ sessionId, studentId }, callback) => {
//     const room = getRoom(sessionId);
//     if (!room) return callback({ error: 'Room not found' });

//     const peer = room.peers.get(studentId);
//     if (!peer) return callback({ error: 'Student not found' });

//     peer.hasMediaControl = true;

//     if (room.pendingSpeakRequests) {
//       room.pendingSpeakRequests.delete(studentId);
//     }

//     io.to(peer.socketId).emit('speak-request-approved');

//     emitStudentList(sessionId);

//     io.to(sessionId).emit('active-speakers',
//       Array.from(room.peers.entries())
//         .filter(([_peerId, p]) => p.hasMediaControl)
//         .map(([peerId, p]) => ({ studentId: peerId, name: p.name }))
//     );

//     callback({ success: true });
//   });

//   // deny speak request
//   socket.on('deny-speak-request', ({ sessionId, studentId }, callback) => {
//     const room = getRoom(sessionId);
//     if (!room) return callback({ error: 'Room not found' });

//     const peer = room.peers.get(studentId);
//     if (!peer) return callback({ error: 'Student not found' });

//     if (room.pendingSpeakRequests) {
//       room.pendingSpeakRequests.delete(studentId);
//     }

//     io.to(peer.socketId).emit('speak-request-denied');

//     io.to(sessionId).emit('active-speakers',
//       Array.from(room.peers.values())
//         .filter(p => p.hasMediaControl)
//         .map(p => ({ studentId: p.peerId, name: p.name }))
//     );

//     callback({ success: true });
//   });

//   // revoke speak
//   socket.on('revoke-speak', ({ sessionId, studentId }, callback) => {
//     const room = getRoom(sessionId);
//     if (!room) return callback({ error: 'Room not found' });

//     const peer = room.peers.get(studentId);
//     if (!peer) return callback({ error: 'Peer not found' });

//     peer.hasMediaControl = false;

//     // close their producers and notify
//     peer.producers.forEach(p => {
//       try {
//         p.close();
//         io.to(sessionId).emit('producer-closed', {
//           producerId: p.id,
//           peerId: peer.peerId,
//           kind: p.kind,
//           source: p.appData?.source,
//         });
//       } catch (err) {
//         console.error('Error closing producer:', err);
//       }
//     });
//     peer.producers = [];

//     // notify student
//     io.to(peer.socketId).emit('speak-revoked');

//     emitStudentList(sessionId);

//     io.to(sessionId).emit('active-speakers',
//       Array.from(room.peers.entries())
//         .filter(([_peerId, p]) => p.hasMediaControl)
//         .map(([peerId, p]) => ({ studentId: peerId, name: p.name }))
//     );

//     callback({ success: true });
//   });

//   // stop-recording request from client
//   socket.on('stop-recording', async ({ sessionId }, callback) => {
//     try {
//       console.log(`Stop recording requested for session: ${sessionId}`);

//       if (!sessionId) {
//         if (callback) callback({ success: false, error: 'sessionId is required' });
//         return;
//       }

//       clearGraceTimer(sessionId, "audio");
//       clearGraceTimer(sessionId, "video");
//       clearGraceTimer(sessionId, "screen");

//       await stopRecordingBridge(sessionId);

//       console.log(`Recording stopped for session: ${sessionId}`);

//       if (callback) callback({ success: true });
//     } catch (error) {
//       console.error(`Failed to stop recording for session ${sessionId}:`, error);
//       if (callback) callback({ success: false, error: error instanceof Error ? error.message : String(error) });
//     }
//   });

//   // leave-classroom
//   socket.on('leave-classroom', ({ sessionId }, callback) => {
//     try {
//       if ((socket as any)._chatCleanup) {
//         (socket as any)._chatCleanup();
//         (socket as any)._chatCleanup = null;
//       }
//       (socket as any)._chatSessionId = null;

//       const room = getRoom(sessionId);
//       if (!room) return callback?.({ error: 'Room not found' });

//       const peer = room.peers.get(user.info.uuid);
//       if (!peer) return callback?.({ error: 'Peer not found' });

//       if (peer.hasMediaControl) {
//         peer.hasMediaControl = false;
//         peer.producers.forEach(p => {
//           try {
//             p.close();
//             io.to(sessionId).emit('producer-closed', {
//               producerId: p.id,
//               peerId: peer.peerId,
//               kind: p.kind,
//               source: p.appData?.source,
//             });
//           } catch (err) {
//             console.error('Error closing producer:', err);
//           }
//         });
//         peer.producers = [];

//         io.to(sessionId).emit(
//           'active-speakers',
//           Array.from(room.peers.values())
//             .filter(p => p.hasMediaControl)
//             .map(p => ({ studentId: p.peerId, name: p.name }))
//         );
//       }

//       peer.consumers.forEach(c => { try { c.close(); } catch { } });
//       peer.transports.forEach(t => { try { t.close(); } catch { } });

//       room.peers.delete(user.info.uuid);

//       if (room.pendingSpeakRequests?.has(user.info.uuid)) {
//         room.pendingSpeakRequests.delete(user.info.uuid);
//       }

//       if (user.role === 'student') {
//         emitStudentLeft(sessionId, user.info.uuid);
//       }

//       emitStudentList(sessionId);

//       socket.leave(sessionId);

//       callback?.({ success: true });
//     } catch (err) {
//       console.error('leave-classroom error:', err);
//       const errorMessage = err instanceof Error ? err.message : String(err);
//       callback?.({ success: false, error: errorMessage });
//     }
//   });

//   // end-class (mentor only)
//   socket.on('end-class', async ({ sessionId }, callback) => {
//     try {
//       const room = getRoom(sessionId);
//       if (!room) return callback?.({ error: 'Room not found' });

//       if (user.role !== 'mentor') {
//         return callback?.({ error: 'Only teacher can end the class' });
//       }

//       for (const [_peerId, peer] of room.peers.entries()) {
//         if (peer.hasMediaControl) peer.hasMediaControl = false;

//         peer.producers.forEach(p => {
//           try {
//             p.close();
//             io.to(sessionId).emit('producer-closed', {
//               producerId: p.id,
//               peerId: peer.peerId,
//               kind: p.kind,
//               source: p.appData?.source,
//             });
//           } catch (err) {
//             console.error('Error closing producer:', err);
//           }
//         });
//         peer.producers = [];

//         peer.consumers.forEach(c => { try { c.close(); } catch { } });
//         peer.consumers = [];

//         peer.transports.forEach(t => { try { t.close(); } catch { } });
//         peer.transports = [];
//       }

//       room.peers.clear();
//       if (room.pendingSpeakRequests) {
//         room.pendingSpeakRequests.clear();
//       }

//       removeRoom(sessionId);

//       io.to(sessionId).emit('class-ended', { sessionId });
//       io.in(sessionId).socketsLeave(sessionId);

//       callback?.({ success: true });
//     } catch (err) {
//       console.error('end-class error:', err);
//       const errorMessage = err instanceof Error ? err.message : String(err);
//       callback({ success: false, error: errorMessage });
//     }
//   });

//   // disconnect handling
//   socket.on('disconnect', (reason) => {
//     console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);

//     const sessionId = (socket as any)._chatSessionId;
//     if (!sessionId) return;

//     const room = getRoom(sessionId);
//     if (!room) return;

//     const peer = room.peers.get(user.info.uuid);
//     if (!peer) return;

//     try {
//       if (peer.hasMediaControl) {
//         peer.hasMediaControl = false;

//         peer.producers.forEach(p => {
//           try {
//             p.close();
//             io.to(sessionId).emit('producer-closed', {
//               producerId: p.id,
//               peerId: peer.peerId,
//               kind: p.kind,
//               source: p.appData?.source,
//             });
//           } catch (err) {
//             console.error('Error closing producer:', err);
//           }
//         });
//         peer.producers = [];

//         io.to(sessionId).emit(
//           'active-speakers',
//           Array.from(room.peers.values())
//             .filter(p => p.hasMediaControl)
//             .map(p => ({ studentId: p.peerId, name: p.name }))
//         );
//       }

//       peer.consumers.forEach(c => { try { c.close(); } catch { } });
//       peer.transports.forEach(t => { try { t.close(); } catch { } });

//       room.peers.delete(user.info.uuid);

//       if (room.pendingSpeakRequests?.has(user.info.uuid)) {
//         room.pendingSpeakRequests.delete(user.info.uuid);
//       }

//       if (user.role === 'student') {
//         io.to(sessionId).emit('student-left', { studentId: user.info.uuid });
//       }

//       io.to(sessionId).emit(
//         'student-list-updated',
//         Array.from(room.peers.values())
//           .filter(p => p.role === 'student')
//           .map(p => ({
//             id: p.peerId,
//             name: p.name,
//             hasMediaControl: p.hasMediaControl || false,
//             socketId: p.socketId,
//           }))
//       );
//     } catch (err) {
//       console.error('disconnect cleanup error:', err);
//     }
//   });

// }; // end classroomSocketHandler
