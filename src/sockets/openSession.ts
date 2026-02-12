import { MediaKind, Worker } from "mediasoup/node/lib/types";
import { Namespace, Server as SocketIOServer, Socket } from "socket.io";
import { createOpenSessionRoomWithBalancedWorker, removeOpenSessionRoom } from "../mediasoup/createOpenSessionRoomWithBalancedWorker";
import { addPeerToOpenSessionRoom, getOpenSessionRoom, deleteOpenSessionRoom } from "../mediasoup/openSessionRoomManager";
import { setupOpenSessionChatHandlers } from "./openSessionChatHandler";

type CallbackResponse = { success: boolean; hasMediaControl?: boolean; error?: string };

type IoLike = Namespace | SocketIOServer;

const resolveChatTarget = (io: IoLike): SocketIOServer => {
    if ("server" in io) {
        return io.server;
    }
    return io;
};

export const openSessionSocketHandler = (
    io: IoLike,
    socket: Socket,
    workers: Worker[],
) => {
    const user = (socket as any).user;

    if (!user) {
        socket.emit("error", { message: "Unauthorized" });
        return;
    }

    const emitStudentList = (sessionId: string) => {
        const room = getOpenSessionRoom(sessionId);
        if (!room) return;

        const students = Array.from(room.peers.values())
            .filter((peer) => peer.role === "student")
            .map((peer) => ({
                id: peer.peerId,
                name: peer.name,
                hasMediaControl: peer.hasMediaControl || false,
                socketId: peer.socketId,
            }));

        io.to(sessionId).emit("student-list-updated", students);
    };

    const emitStudentLeft = (sessionId: string, studentId: string) => {
        io.to(sessionId).emit("student-left", { studentId });
    };

    socket.on(
        "join-classroom",
        async (
            { sessionId }: { sessionId: string },
            callback: (response: CallbackResponse) => void,
        ) => {
            try {
                const room = await createOpenSessionRoomWithBalancedWorker(sessionId, workers);
                addPeerToOpenSessionRoom(
                    sessionId,
                    user.info.uuid,
                    socket.id,
                    user.info.name,
                    user.role,
                );
                socket.join(sessionId);

                if ((socket as any)._chatSessionId !== sessionId) {
                    if ((socket as any)._chatCleanup) {
                        (socket as any)._chatCleanup();
                    }

                    const cleanup = setupOpenSessionChatHandlers(resolveChatTarget(io), socket, sessionId);

                    (socket as any)._chatSessionId = sessionId;
                    (socket as any)._chatCleanup = cleanup;
                }

                if (room?.router?.rtpCapabilities) {
                    socket.emit("router-rtp-capabilities", room.router.rtpCapabilities);

                    if (user.role === "mentor") {
                        if (room.pendingSpeakRequests) {
                            socket.emit(
                                "pending-speak-requests",
                                Array.from(room.pendingSpeakRequests.values()),
                            );
                        }

                        const activeSpeakers = Array.from(room.peers.values())
                            .filter((peer) => peer.hasMediaControl && peer.peerId !== user.info.uuid)
                            .map((peer) => ({ studentId: peer.peerId, name: peer.name }));
                        socket.emit("active-speakers", activeSpeakers);
                    }
                } else {
                    socket.emit("error", { message: "Room or router not available" });
                }

                emitStudentList(sessionId);

                const peer = room.peers.get(user.info.uuid);
                callback({
                    success: true,
                    hasMediaControl: peer?.hasMediaControl || false,
                });
            } catch (err) {
                console.error("join-open-session error:", err);
                socket.emit("error", { message: "join-classroom failed" });
                const errorMessage = err instanceof Error ? err.message : String(err);
                callback({ success: false, error: errorMessage });
            }
        },
    );

    socket.on("create-transport", async ({ sessionId }, callback) => {
        try {
            const room = getOpenSessionRoom(sessionId);
            if (!room) throw new Error("Room not found");
            const router = room.router;

            const transport = await router.createWebRtcTransport({
                listenIps: [{ ip: "0.0.0.0", announcedIp: "34.100.199.108" }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });

            const peer = room.peers.get(user.info.uuid);
            peer?.transports.push(transport);

            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        } catch (err) {
            console.error("create-transport error", err);
            callback({ error: "create-transport failed" });
        }
    });

    socket.on(
        "connect-transport",
        async ({ transportId, dtlsParameters, sessionId }, callback) => {
            try {
                const room = getOpenSessionRoom(sessionId);
                if (!room) throw new Error("Room not found");

                const peer = room.peers.get(user.info.uuid);
                if (!peer) throw new Error("Peer not found");

                const transport = peer.transports.find((t) => t.id === transportId);
                if (!transport) throw new Error("Transport not found");

                await transport.connect({ dtlsParameters });

                callback({});
            } catch (err) {
                console.error("connect-transport error", err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                callback({ error: errorMessage });
            }
        },
    );

    socket.on(
        "produce",
        async ({ sessionId, transportId, kind, rtpParameters, appData }, callback) => {
            try {
                const room = getOpenSessionRoom(sessionId);
                if (!room) throw new Error("Room not found");

                const peer = room.peers.get(user.info.uuid);
                if (!peer) throw new Error("Peer not found");

                if (user.role !== "mentor" && !peer.hasMediaControl) {
                    callback({ error: "Not authorized to use mic/cam" });
                    return;
                }

                const transport = peer.transports.find((t) => t.id === transportId);
                if (!transport) throw new Error("Transport not found");

                const source = appData?.source;
                if (!source) {
                    callback({ error: "Missing appData.source" });
                    return;
                }

                const existingProducer = peer.producers.find(
                    (p) => p.kind === kind && p.appData?.source === source,
                );

                if (existingProducer) {
                    existingProducer.close();
                    peer.producers = peer.producers.filter((p) => p.id !== existingProducer.id);

                    socket.to(sessionId).emit("producer-closed", {
                        producerId: existingProducer.id,
                        peerId: user.info.uuid,
                        kind: existingProducer.kind,
                        source: existingProducer.appData?.source,
                    });
                }

                const producer = await transport.produce({
                    kind,
                    rtpParameters,
                    appData: { source, role: user.role },
                });
                peer.producers.push(producer);

                socket.to(sessionId).emit("new-producer", {
                    producerId: producer.id,
                    kind,
                    peerId: user.info.uuid,
                    appData: producer.appData,
                    isTeacher: user.role === "mentor",
                    name: user.info.name,
                });

                callback({ id: producer.id });
            } catch (err) {
                console.error("produce error", err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                callback({ error: errorMessage });
            }
        },
    );

    socket.on("producer-closed", ({ sessionId, producerId, peerId, kind, source }) => {
        socket.to(sessionId).emit("producer-closed", { producerId, peerId, kind, source });
    });

    socket.on(
        "consume",
        async ({ sessionId, transportId, producerId, rtpCapabilities }, callback) => {
            try {
                const room = getOpenSessionRoom(sessionId);
                if (!room) throw new Error("Room not found");

                const peer = room.peers.get(user.info.uuid);
                if (!peer) throw new Error("Peer not found");

                const transport = peer.transports.find((t) => t.id === transportId);
                if (!transport) throw new Error("Transport not found");

                const router = room.router;
                if (!router.canConsume({ producerId, rtpCapabilities })) {
                    throw new Error("Cannot consume this producer");
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
                console.error("consume error", err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                callback({ error: errorMessage });
            }
        },
    );

    socket.on("get-existing-producers", ({ sessionId }, callback) => {
        try {
            const room = getOpenSessionRoom(sessionId);
            if (!room) throw new Error("Room not found");

            const producers: {
                id: string;
                kind: MediaKind;
                peerId: string;
                source: string;
                isTeacher: boolean;
            }[] = [];

            room.peers.forEach((peer, peerId) => {
                peer.producers
                    .filter((producer) => !producer.closed)
                    .forEach((producer) => {
                        producers.push({
                            id: producer.id,
                            kind: producer.kind,
                            peerId,
                            source: (producer.appData?.source as string) || "unknown",
                            isTeacher: (producer.appData?.role as string) === "mentor",
                        });
                    });
            });

            callback?.({ producers });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            callback?.({ producers: [], error: errorMessage });
        }
    });

    socket.on("toggle-producer", async ({ sessionId, kind, source, action }, callback) => {
        try {
            const room = getOpenSessionRoom(sessionId);
            if (!room) throw new Error("Room not found");

            const peer = room.peers.get(user.info.uuid);
            if (!peer) throw new Error("Peer not found");

            if (user.role !== "mentor" && !peer.hasMediaControl) {
                callback({ error: "Not authorized to use mic/cam" });
                return;
            }

            const producer = peer.producers.find(
                (p) => p.kind === kind && p.appData?.source === source,
            );
            if (!producer) throw new Error("Producer not found");

            if (action === "pause") await producer.pause();
            else if (action === "resume") await producer.resume();
            else throw new Error("Invalid action");

            io.to(sessionId).emit("peer-media-status", {
                peerId: user.info.uuid,
                kind,
                isPaused: action === "pause",
            });

            callback({ success: true });
        } catch (err) {
            console.error("toggle-producer error:", err);
            callback({ error: "Toggle producer failed" });
        }
    });

    socket.on("request-to-speak", ({ sessionId }, callback) => {
        const room = getOpenSessionRoom(sessionId);
        if (!room) return callback({ error: "Room not found" });

        if (!room.pendingSpeakRequests) {
            room.pendingSpeakRequests = new Map();
        }

        if (room.pendingSpeakRequests.has(user.info.uuid)) {
            callback({ error: "Already requested" });
            return;
        }

        const requestData = {
            studentId: user.info.uuid,
            name: user.info.name,
        };

        room.pendingSpeakRequests.set(user.info.uuid, requestData);

        io.to(sessionId).emit("speak-request", requestData);

        callback({ success: true });
    });

    socket.on("approve-speak-request", ({ sessionId, studentId }, callback) => {
        const room = getOpenSessionRoom(sessionId);
        if (!room) return callback({ error: "Room not found" });

        const peer = room.peers.get(studentId);
        if (!peer) return callback({ error: "Student not found" });

        peer.hasMediaControl = true;

        room.pendingSpeakRequests?.delete(studentId);

        io.to(peer.socketId).emit("speak-request-approved");

        emitStudentList(sessionId);

        io.to(sessionId).emit(
            "active-speakers",
            Array.from(room.peers.entries())
                .filter(([, p]) => p.hasMediaControl)
                .map(([peerId, p]) => ({ studentId: peerId, name: p.name })),
        );

        callback({ success: true });
    });

    socket.on("deny-speak-request", ({ sessionId, studentId }, callback) => {
        const room = getOpenSessionRoom(sessionId);
        if (!room) return callback({ error: "Room not found" });

        const peer = room.peers.get(studentId);
        if (!peer) return callback({ error: "Student not found" });

        room.pendingSpeakRequests?.delete(studentId);

        io.to(peer.socketId).emit("speak-request-denied");

        io.to(sessionId).emit(
            "active-speakers",
            Array.from(room.peers.values())
                .filter((p) => p.hasMediaControl)
                .map((p) => ({ studentId: p.peerId, name: p.name })),
        );

        callback({ success: true });
    });

    socket.on("revoke-speak", ({ sessionId, studentId }, callback) => {
        const room = getOpenSessionRoom(sessionId);
        if (!room) return callback({ error: "Room not found" });

        const peer = room.peers.get(studentId);
        if (!peer) return callback({ error: "Student not found" });

        peer.hasMediaControl = false;

        peer.producers.forEach((producer) => {
            try {
                producer.close();
                io.to(sessionId).emit("producer-closed", {
                    producerId: producer.id,
                    peerId: peer.peerId,
                    kind: producer.kind,
                    source: producer.appData?.source,
                });
            } catch (err) {
                console.error("Error closing producer:", err);
            }
        });
        peer.producers = [];

        io.to(peer.socketId).emit("speak-revoked");

        emitStudentList(sessionId);

        io.to(sessionId).emit(
            "active-speakers",
            Array.from(room.peers.entries())
                .filter(([, p]) => p.hasMediaControl)
                .map(([peerId, p]) => ({ studentId: peerId, name: p.name })),
        );

        callback({ success: true });
    });

    socket.on("leave-classroom", ({ sessionId }, callback) => {
        try {
            if ((socket as any)._chatCleanup) {
                (socket as any)._chatCleanup();
                (socket as any)._chatCleanup = null;
            }
            (socket as any)._chatSessionId = null;

            const room = getOpenSessionRoom(sessionId);
            if (!room) return callback?.({ error: "Room not found" });

            const peer = room.peers.get(user.info.uuid);
            if (!peer) return callback?.({ error: "Peer not found" });

            if (peer.hasMediaControl) {
                peer.hasMediaControl = false;

                peer.producers.forEach((producer) => {
                    try {
                        producer.close();
                        io.to(sessionId).emit("producer-closed", {
                            producerId: producer.id,
                            peerId: peer.peerId,
                            kind: producer.kind,
                            source: producer.appData?.source,
                        });
                    } catch (err) {
                        console.error("Error closing producer:", err);
                    }
                });
                peer.producers = [];

                io.to(sessionId).emit(
                    "active-speakers",
                    Array.from(room.peers.values())
                        .filter((p) => p.hasMediaControl)
                        .map((p) => ({ studentId: p.peerId, name: p.name })),
                );
            }

            peer.consumers.forEach((consumer) => {
                try {
                    consumer.close();
                } catch {
                    /* noop */
                }
            });
            peer.transports.forEach((transport) => {
                try {
                    transport.close();
                } catch {
                    /* noop */
                }
            });

            room.peers.delete(user.info.uuid);

            if (room.pendingSpeakRequests?.has(user.info.uuid)) {
                room.pendingSpeakRequests.delete(user.info.uuid);
            }

            if (user.role === "student") {
                emitStudentLeft(sessionId, user.info.uuid);
            }

            emitStudentList(sessionId);

            socket.leave(sessionId);

            callback?.({ success: true });
        } catch (err) {
            console.error("leave-open-session error:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback?.({ success: false, error: errorMessage });
        }
    });

    socket.on("end-class", ({ sessionId }, callback) => {
        try {
            const room = getOpenSessionRoom(sessionId);
            if (!room) return callback?.({ error: "Room not found" });

            if (user.role !== "mentor") {
                return callback?.({ error: "Only teacher can end the class" });
            }

            for (const [, peer] of room.peers.entries()) {
                peer.hasMediaControl = false;

                peer.producers.forEach((producer) => {
                    try {
                        producer.close();
                        io.to(sessionId).emit("producer-closed", {
                            producerId: producer.id,
                            peerId: peer.peerId,
                            kind: producer.kind,
                            source: producer.appData?.source,
                        });
                    } catch (err) {
                        console.error("Error closing producer:", err);
                    }
                });
                peer.producers = [];

                peer.consumers.forEach((consumer) => {
                    try {
                        consumer.close();
                    } catch {
                        /* noop */
                    }
                });
                peer.consumers = [];

                peer.transports.forEach((transport) => {
                    try {
                        transport.close();
                    } catch {
                        /* noop */
                    }
                });
                peer.transports = [];
            }

            room.peers.clear();
            room.pendingSpeakRequests?.clear();

            removeOpenSessionRoom(sessionId);

            io.to(sessionId).emit("class-ended", { sessionId });
            io.in(sessionId).socketsLeave(sessionId);

            callback?.({ success: true });
        } catch (err) {
            console.error("end-open-session error:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            callback?.({ success: false, error: errorMessage });
        }
    });

    socket.on("teacher:announcement", ({ token, data }) => {
        const room = getOpenSessionRoom(token);
        console.log({ room });
        console.log({ token, data });
        if (!room) {
            return;
        }
        io.to(token).emit("announcement", data);
    });

    socket.on("disconnect", (reason) => {
        console.log(`Open session socket disconnected: ${socket.id}, reason: ${reason}`);

        const sessionId = (socket as any)._chatSessionId;
        if (!sessionId) return;

        const room = getOpenSessionRoom(sessionId);
        if (!room) return;

        const peer = room.peers.get(user.info.uuid);
        if (!peer) return;

        try {
            if (peer.hasMediaControl) {
                peer.hasMediaControl = false;

                peer.producers.forEach((producer) => {
                    try {
                        producer.close();
                        io.to(sessionId).emit("producer-closed", {
                            producerId: producer.id,
                            peerId: peer.peerId,
                            kind: producer.kind,
                            source: producer.appData?.source,
                        });
                    } catch (err) {
                        console.error("Error closing producer:", err);
                    }
                });
                peer.producers = [];

                io.to(sessionId).emit(
                    "active-speakers",
                    Array.from(room.peers.values())
                        .filter((p) => p.hasMediaControl)
                        .map((p) => ({ studentId: p.peerId, name: p.name })),
                );
            }

            peer.consumers.forEach((consumer) => {
                try {
                    consumer.close();
                } catch {
                    /* noop */
                }
            });
            peer.transports.forEach((transport) => {
                try {
                    transport.close();
                } catch {
                    /* noop */
                }
            });

            room.peers.delete(user.info.uuid);

            room.pendingSpeakRequests?.delete(user.info.uuid);

            if (user.role === "student") {
                io.to(sessionId).emit("student-left", { studentId: user.info.uuid });
            }

            io.to(sessionId).emit(
                "student-list-updated",
                Array.from(room.peers.values())
                    .filter((p) => p.role === "student")
                    .map((p) => ({
                        id: p.peerId,
                        name: p.name,
                        hasMediaControl: p.hasMediaControl || false,
                        socketId: p.socketId,
                    })),
            );

            // 🧹 CRITICAL FIX: Remove empty room to prevent memory leak
            if (room.peers.size === 0) {
                console.log(`🧹 Removing empty open session room: ${sessionId}`);
                deleteOpenSessionRoom(sessionId);
                
                // Also cleanup chat settings for this session
                if ((socket as any)._chatCleanup) {
                    (socket as any)._chatCleanup();
                }
            }
        } catch (err) {
            console.error("disconnect cleanup error:", err);
        }
    });
};

