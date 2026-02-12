// import { Socket } from "socket.io";
// import { rooms } from "../mediasoup/roomManager";

// export const adminSocketHandler = (socket: Socket) => {
//     const user = (socket as any).user;
//     if (!user || user.role !== "admin") {
//         return socket.emit("error", { message: "Unauthorized" });
//     }

//     console.log("✅ Admin connected:", user.info.email);

//     (socket as any).adminTransports = new Map(); 
//     (socket as any).adminConsumers = new Map();  
//     (socket as any).rtpCapabilities = null;     

//     socket.on("get-rtp-capabilities", (callback) => {
//         try {
//             const caps: Record<string, any> = {};

//             for (const [sessionId, room] of rooms.entries()) {
//                 if (room.router) {
//                     caps[sessionId] = room.router.rtpCapabilities;
//                 }
//             }

//             console.log(caps);
//             callback({ success: true, rtpCapabilities: caps });
//         } catch (err) {
//             console.error("get-rtp-capabilities error:", err);
//             callback({ success: false, error: err instanceof Error ? err.message : String(err) });
//         }
//     });

//     /**
//      * 🔹 Create transports for admin across all rooms
//      */
//     socket.on("create-admin-transports", async ({ rtpCapabilities }, callback) => {
//         try {
//             (socket as any).rtpCapabilities = rtpCapabilities;

//             const transportParams: any[] = [];

//             for (const [sessionId, room] of rooms.entries()) {
//                 // Create transport
//                 const transport = await room.router.createWebRtcTransport({
//                     listenIps: [{ ip: "0.0.0.0", announcedIp: "34.100.199.108" }],
//                     enableUdp: true,
//                     enableTcp: true,
//                     preferUdp: true,
//                 });

//                 (socket as any).adminTransports.set(sessionId, transport);

//                 transportParams.push({
//                     sessionId,
//                     id: transport.id,
//                     iceParameters: transport.iceParameters,
//                     iceCandidates: transport.iceCandidates,
//                     dtlsParameters: transport.dtlsParameters,
//                 });

//                 // Consume existing producers
//                 for (const peer of room.peers.values()) {
//                     for (const producer of peer.producers) {
//                         if (room.router.canConsume({ producerId: producer.id, rtpCapabilities })) {
//                             const consumer = await transport.consume({
//                                 producerId: producer.id,
//                                 rtpCapabilities,
//                                 paused: true,
//                             });
//                             await consumer.resume();

//                             (socket as any).adminConsumers.set(producer.id, consumer);

//                             socket.emit("admin-new-consumer", {
//                                 sessionId,
//                                 id: consumer.id,
//                                 producerId: producer.id,
//                                 kind: consumer.kind,
//                                 rtpParameters: consumer.rtpParameters,
//                                 peerId: peer.peerId,
//                                 name: peer.name,
//                                 role: peer.role,
//                             });
//                         }
//                     }
//                 }
//             }

//             callback({ success: true, transports: transportParams });
//         } catch (err) {
//             console.error("create-admin-transports error:", err);
//             callback({ success: false, error: err instanceof Error ? err.message : String(err) });
//         }
//     });

//     /**
//      * 🔹 Connect admin transport
//      */
//     socket.on("connect-admin-transport", async ({ sessionId, transportId, dtlsParameters }, callback) => {
//         try {
//             const transport = (socket as any).adminTransports.get(sessionId);
//             if (!transport || transport.id !== transportId) throw new Error("Transport not found");

//             await transport.connect({ dtlsParameters });
//             callback({ success: true });
//         } catch (err) {
//             console.error("connect-admin-transport error:", err);
//             callback({ success: false, error: err instanceof Error ? err.message : String(err) });
//         }
//     });

//     /**
//      * 🔹 Auto-subscribe when new producer appears in a room
//      */
//     for (const [sessionId, room] of rooms.entries()) {
//         room.events.on("new-producer", async (producer: any) => {
//             const transport = (socket as any).adminTransports.get(sessionId);
//             if (!transport) return;

//             try {
//                 const rtpCapabilities = (socket as any).rtpCapabilities;
//                 if (!rtpCapabilities || !room.router.canConsume({ producerId: producer.id, rtpCapabilities })) {
//                     return;
//                 }

//                 const consumer = await transport.consume({
//                     producerId: producer.id,
//                     rtpCapabilities,
//                     paused: true,
//                 });
//                 await consumer.resume();

//                 (socket as any).adminConsumers.set(producer.id, consumer);

//                 socket.emit("admin-new-consumer", {
//                     sessionId,
//                     id: consumer.id,
//                     producerId: producer.id,
//                     kind: consumer.kind,
//                     rtpParameters: consumer.rtpParameters,
//                     peerId: producer.appData?.peerId,
//                     role: producer.appData?.role,
//                 });
//             } catch (err) {
//                 console.error("admin auto-subscribe error:", err);
//             }
//         });
//     }

//     /**
//      * 🔹 Cleanup on disconnect
//      */
//     socket.on("disconnect", () => {
//         console.log("❌ Admin disconnected:", user.info.email);
//         (socket as any).adminConsumers.forEach((c: any) => c.close());
//         (socket as any).adminTransports.forEach((t: any) => t.close());
//     });
// };
