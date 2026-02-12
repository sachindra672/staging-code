import axios from "axios";

import type {
    Router,
    Consumer,
    PlainTransport,
    RtpCodecParameters,
    Producer
} from "mediasoup/node/lib/types";

import {
    getRoom,
    addRecordingTransport,
    stopRecordingTransports
} from "./roomManager";

const RECORDING_VM_URL =
    process.env.RECORDING_VM_URL ?? "http://34.14.193.163";
const PUBLIC_IP = process.env.PUBLIC_IP ?? "34.100.199.108";

export type RecordingKind = "audio" | "video" | "screen";

type ActiveRecording = {
    kind: RecordingKind;
    startedAt: number;
};

type RecordingStartOptions = {
    startedAt?: number;
};

type RecordingStopOptions = {
    kind?: RecordingKind;
    stoppedAt?: number;
};

const activeRecordings = new Map<string, Map<RecordingKind, ActiveRecording>>();

function getActiveMap(sessionId: string) {
    let map = activeRecordings.get(sessionId);
    if (!map) {
        map = new Map();
        activeRecordings.set(sessionId, map);
    }
    return map;
}

function removeActive(sessionId: string, kind: RecordingKind) {
    const map = activeRecordings.get(sessionId);
    if (!map) return;
    map.delete(kind);
    if (!map.size) {
        activeRecordings.delete(sessionId);
    }
}

// const graceTimers = new Map<string, NodeJS.Timeout>();

// function timerKey(sessionId: string, kind: RecordingKind): string {
//     return `${sessionId}-${kind}`;
// }

// function clearGraceTimer(sessionId: string, kind: RecordingKind): void {
//     const key = timerKey(sessionId, kind);
//     const timer = graceTimers.get(key);
//     if (timer) {
//         clearTimeout(timer);
//         graceTimers.delete(key);
//         console.log(`Cleared ${kind} grace timer for ${sessionId}`);
//     }
// }

function extractCodecDetails(
    codec: RtpCodecParameters,
    kind: RecordingKind
) {
    const codecName = codec.mimeType.split("/")[1]?.toLowerCase();
    if (!codecName) {
        throw new Error("Unable to derive codec name for recorder");
    }
    const payloadType = codec.payloadType;
    const clockRate = codec.clockRate;
    const channels =
        kind === "audio" ? codec.channels ?? 2 : undefined;
    return { codecName, payloadType, clockRate, channels };
}

function pickProducer(
    mentorPeer: any,
    kind: RecordingKind
): Producer | undefined {
    if (kind === "audio") {
        return mentorPeer.producers.find((p: Producer) => p.kind === "audio");
    }
    if (kind === "video") {
        return mentorPeer.producers.find((p: Producer) => {
            if (p.kind !== "video") return false;
            const source = p.appData?.source ?? p.appData?.content;
            return source !== "screen" && source !== "presentation";
        });
    }
    // screen
    return mentorPeer.producers.find((p: Producer) => {
        if (p.kind !== "video") return false;
        const source = p.appData?.source ?? p.appData?.content;
        return source === "screen" || source === "presentation" || p.appData?.isScreen;
    });
}

export async function startRecordingBridge(
    sessionId: string,
    kind: RecordingKind,
    options: RecordingStartOptions = {}
) {
    const startedAt = options.startedAt ?? Date.now();

    try {
        console.log(`🎬 Starting recording bridge for ${sessionId} (${kind})`);

        // ✅ FIX 1: Check if recording already exists and stop it first
        const activeMap = getActiveMap(sessionId);
        const existingRecording = activeMap.get(kind);

        // if (existingRecording) {
        //     console.log(`⚠️ Recording already active for ${sessionId} (${kind}), stopping it first...`);
        //     try {
        //         await stopRecordingBridge(sessionId, {
        //             kind,
        //             stoppedAt: Date.now()
        //         });
        //         // Wait a bit for cleanup
        //         await new Promise(resolve => setTimeout(resolve, 500));
        //     } catch (err) {
        //         console.warn(`Failed to stop existing recording before starting new one:`, err);
        //     }
        // }

        if (existingRecording) {
            // ✅ FIX: For audio/video, don't restart - return existing
            // Only screen recordings can be restarted
            if (kind === "audio" || kind === "video") {
                console.log(`ℹ️ Recording already active for ${sessionId} (${kind}), returning existing recording`);
                return {
                    success: true,
                    startedAt: existingRecording.startedAt,
                    message: "Recording already in progress"
                };
            }

            // For screen, allow restart (stop old, start new)
            console.log(`⚠️ Screen recording already active for ${sessionId}, stopping it first...`);
            try {
                await stopRecordingBridge(sessionId, {
                    kind,
                    stoppedAt: Date.now()
                });
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                console.warn(`Failed to stop existing recording before starting new one:`, err);
            }
        }

        const room = getRoom(sessionId);
        if (!room) throw new Error(`Room not found for ${sessionId}`);

        const router: Router = room.router;

        const mentorPeer = Array.from(room.peers.values()).find(
            (p) => p.role === "mentor"
        );

        if (!mentorPeer) {
            throw new Error(`No mentor in room ${sessionId}`);
        }

        const producer = pickProducer(mentorPeer, kind);

        if (!producer) {
            throw new Error(`No ${kind} producer found for mentor`);
        }

        const senderTransport: PlainTransport = await router.createPlainTransport({
            listenIp: { ip: "0.0.0.0", announcedIp: PUBLIC_IP },
            rtcpMux: false,
            comedia: false
        });

        senderTransport.on("tuple", (tuple) => {
            console.log(
                `[recorder][${kind}] RTP tuple selected`,
                `${tuple.localIp}:${tuple.localPort} → ${tuple.remoteIp}:${tuple.remotePort}`
            );
        });

        senderTransport.on("rtcptuple", (tuple) => {
            console.log(
                `[recorder][${kind}] RTCP tuple selected`,
                `${tuple.localIp}:${tuple.localPort} → ${tuple.remoteIp}:${tuple.remotePort}`
            );
        });

        senderTransport.on("trace", (trace) => {
            console.log(`[recorder][${kind}] transport trace`, trace);
        });

        const consumer: Consumer = await senderTransport.consume({
            producerId: producer.id,
            rtpCapabilities: router.rtpCapabilities,
            paused: true,
            appData: { source: "recorder", kind }
        });

        console.log("[recorder] consumer params", {
            id: consumer.id,
            kind: consumer.kind,
            encodings: consumer.rtpParameters.encodings,
            codecs: consumer.rtpParameters.codecs
        });

        const codec = consumer.rtpParameters.codecs[0];
        if (!codec) throw new Error("Missing codec information on consumer");

        const { codecName, payloadType, clockRate, channels } =
            extractCodecDetails(codec, kind === "screen" ? "video" : kind);

        const tuple = senderTransport.tuple;
        const rtcpTuple = senderTransport.rtcpTuple;

        if (!tuple || !rtcpTuple) {
            throw new Error("PlainTransport tuple missing");
        }

        const { data } = await axios.post(`${RECORDING_VM_URL}/start`, {
            sessionId,
            kind,
            startedAt,
            ip: PUBLIC_IP,
            port: tuple.localPort,
            rtcpPort: rtcpTuple.localPort,
            codecPayloadType: payloadType,
            codecName,
            clockRate,
            channels
        });

        if (!data?.success) {
            throw new Error(data?.error ?? "Recorder VM rejected /start");
        }

        console.log("Recorder VM →", data);

        await senderTransport.connect({
            ip: data.target.ip,
            port: data.target.port,
            rtcpPort: data.target.rtcpPort
        });

        await consumer.resume();
        console.log(`[recorder] consumer resumed ${consumer.id} (${consumer.kind})`);

        if (consumer.setPreferredLayers) {
            try {
                await consumer.setPreferredLayers({ spatialLayer: 1, temporalLayer: 1 });
            } catch (err) {
                console.warn("Failed to set preferred layers:", err);
            }
        }

        if (consumer.requestKeyFrame) {
            try {
                await consumer.requestKeyFrame();
            } catch (err) {
                console.warn("Failed to request keyframe:", err);
            }
        }

        addRecordingTransport(sessionId, kind, senderTransport, consumer);

        activeMap.set(kind, { kind, startedAt });

        console.log(`✅ Recording bridge active for ${sessionId} (${kind})`);
        return { success: true, startedAt, target: data.target };

    } catch (err: any) {
        console.error(`❌ startRecordingBridge error [${kind}]:`, err?.message ?? err);
        return { success: false, error: err?.message ?? String(err) };
    }
}

export async function stopRecordingBridge(
    sessionId: string,
    options: RecordingStopOptions = {}
) {
    const { kind, stoppedAt } = options;

    try {
        console.log(
            `🛑 Stopping recording for session ${sessionId}` +
            (kind ? ` (${kind})` : " (all tracks)")
        );

        if (kind) {
            await stopRecordingTransports(sessionId, kind);

            const map = activeRecordings.get(sessionId);
            const track = map?.get(kind);

            const stopPayload = {
                sessionId,
                kind,
                stoppedAt: stoppedAt ?? Date.now()
            };

            console.log(`📤 Sending stop request to recorder VM:`, stopPayload);
            await axios.post(`${RECORDING_VM_URL}/stop`, stopPayload);

            removeActive(sessionId, kind);
            console.log(`✅ Stopped recording for ${sessionId} (${kind})`);
        } else {
            const map = activeRecordings.get(sessionId);
            const now = stoppedAt ?? Date.now();

            const tracksPayload = map
                ? Array.from(map.values()).map((entry) => ({
                    kind: entry.kind,
                    stoppedAt: now
                }))
                : [];

            await stopRecordingTransports(sessionId);

            console.log(`📤 Sending stop request to recorder VM (all tracks):`, {
                sessionId,
                stoppedAt: now,
                tracks: tracksPayload
            });
            await axios.post(`${RECORDING_VM_URL}/stop`, {
                sessionId,
                stoppedAt: now,
                tracks: tracksPayload
            });

            activeRecordings.delete(sessionId);
            console.log(`✅ Stopped all recordings for ${sessionId}`);
        }

        return { success: true };

    } catch (err: any) {
        console.error("❌ stopRecordingBridge error:", err?.message ?? err);
        return { success: false, error: err?.message ?? String(err) };
    }
}

export async function getRecordingStatus() {
    try {
        const { data } = await axios.get(`${RECORDING_VM_URL}/status`);
        return data;
    } catch (err: any) {
        console.error("getRecordingStatus error:", err?.message ?? err);
        return { success: false, error: err?.message ?? String(err) };
    }
}

