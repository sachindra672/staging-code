import axios from "axios";
import {
  Router,
  PlainTransport,
  Consumer,
  RtpCodecParameters,
  Producer
} from "mediasoup/node/lib/types";

import {
  getRoom,
  addRecordingTransport,
  stopRecordingTransports
} from "./roomManager";

// ---------------------
// CONFIG
// ---------------------
const RECORDING_VM_URL = process.env.RECORDING_VM_URL ?? "http://34.14.193.163";
const PUBLIC_IP = process.env.PUBLIC_IP ?? "34.100.199.108";

export type RecordingKind = "audio" | "video" | "screen";

// Active recordings (per track)
type ActiveRecording = {
  kind: RecordingKind;
  startedAt: number;
};

const activeRecordings = new Map<string, Map<RecordingKind, ActiveRecording>>();

// ---------------------
// HELPERS
// ---------------------

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
  if (!map.size) activeRecordings.delete(sessionId);
}

export const graceTimers = new Map<string, NodeJS.Timeout>();

export function timerKey(sessionId: string, kind: RecordingKind) {
  return `${sessionId}-${kind}`;
}

export function clearGraceTimer(sessionId: string, kind: RecordingKind) {
  const key = timerKey(sessionId, kind);
  const t = graceTimers.get(key);
  if (t) {
    clearTimeout(t);
    graceTimers.delete(key);
    console.log(`🧽 Cleared grace timer → ${key}`);
  }
}

function extractCodecDetails(codec: RtpCodecParameters, kind: RecordingKind) {
  const codecName = codec.mimeType.split("/")[1]?.toLowerCase();
  if (!codecName) throw new Error("No codec name");
  const payloadType = codec.payloadType;
  const clockRate = codec.clockRate;
  const channels = kind === "audio" ? codec.channels ?? 2 : undefined;
  return { codecName, payloadType, clockRate, channels };
}

// Select correct mentor producer
function pickProducer(mentorPeer: any, kind: RecordingKind): Producer | undefined {
  if (kind === "audio") {
    return mentorPeer.producers.find((p: Producer) => p.kind === "audio");
  }

  if (kind === "video") {
    return mentorPeer.producers.find((p: Producer) => {
      if (p.kind !== "video") return false;
      const src = p.appData?.source;
      return src !== "screen" && src !== "presentation";
    });
  }

  // screen
  return mentorPeer.producers.find((p: Producer) => {
    if (p.kind !== "video") return false;
    const src = p.appData?.source;
    return src === "screen" || src === "presentation";
  });
}

// ------------------------------------------------------------
//  START RECORDING — clean and refresh-safe
// ------------------------------------------------------------
export async function startRecordingBridge(
  sessionId: string,
  kind: RecordingKind,
  options: { startedAt?: number } = {}
) {
  const startedAt = options.startedAt ?? Date.now();

  try {
    console.log(`🎬 startRecordingBridge → ${sessionId} (${kind})`);

    const activeMap = getActiveMap(sessionId);
    const existing = activeMap.get(kind);

    // If already active, just return
    if (existing) {
      clearGraceTimer(sessionId, kind);
      return {
        success: true,
        startedAt: existing.startedAt,
        message: "Recording already active"
      };
    }

    // Fetch room & mentor producer
    const room = getRoom(sessionId);
    if (!room) throw new Error(`Room not found: ${sessionId}`);

    const mentorPeer = Array.from(room.peers.values()).find(p => p.role === "mentor");
    if (!mentorPeer) throw new Error("No mentor present");

    const producer = pickProducer(mentorPeer, kind);
    if (!producer) throw new Error(`No producer for ${kind}`);

    // -----------------------------
    // Create transport
    // -----------------------------
    const transport: PlainTransport = await room.router.createPlainTransport({
      listenIp: { ip: "0.0.0.0", announcedIp: PUBLIC_IP },
      rtcpMux: false,
      comedia: false
    });

    // Create consumer
    const consumer: Consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: room.router.rtpCapabilities,
      paused: true,
      appData: { source: "recorder", kind }
    });

    const codec = consumer.rtpParameters.codecs[0];
    if (!codec) throw new Error("No codec");

    const { codecName, payloadType, clockRate, channels } = extractCodecDetails(codec, kind);

    const tuple = transport.tuple;
    const rtcpTuple = transport.rtcpTuple;

    if (!tuple || !rtcpTuple) throw new Error("Transport tuples missing");

    // -----------------------------
    // Signal START to recorder VM
    // -----------------------------
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

    if (!data?.success) throw new Error(data?.error ?? "Recorder rejected /start");

    // Connect to Recorder VM target
    await transport.connect({
      ip: data.target.ip,
      port: data.target.port,
      rtcpPort: data.target.rtcpPort
    });

    await consumer.resume();

    // Improve video stability
    if (kind === "video" && consumer.requestKeyFrame) {
      try {
        await consumer.requestKeyFrame();
      } catch {}
    }

    addRecordingTransport(sessionId, kind, transport, consumer);

    activeMap.set(kind, { kind, startedAt });

    console.log(`✅ Recording started (${sessionId}:${kind})`);
    return { success: true, startedAt };

  } catch (err: any) {
    console.error(`❌ startRecordingBridge[${kind}] error:`, err?.message ?? err);
    return { success: false, error: err?.message ?? String(err) };
  }
}

// ------------------------------------------------------------
// STOP RECORDING
// ------------------------------------------------------------
export async function stopRecordingBridge(
  sessionId: string,
  options: { kind?: RecordingKind; stoppedAt?: number } = {}
) {
  const { kind, stoppedAt = Date.now() } = options;

  if (kind) {
    clearGraceTimer(sessionId, kind);
  } else {
    // 🧹 CRITICAL FIX: Clear all timers for this session
    clearGraceTimer(sessionId, "audio");
    clearGraceTimer(sessionId, "video");
    clearGraceTimer(sessionId, "screen");
  }

  try {
    console.log(`🛑 stopRecordingBridge → ${sessionId} (${kind ?? "ALL"})`);

    if (kind) {
      await stopRecordingTransports(sessionId, kind);

      await axios.post(`${RECORDING_VM_URL}/stop`, {
        sessionId,
        kind,
        stoppedAt
      });

      removeActive(sessionId, kind);
      return { success: true };
    }

    // stop all kinds
    await stopRecordingTransports(sessionId);

    const map = activeRecordings.get(sessionId);
    const payloadTracks = map
      ? Array.from(map.values()).map(tr => ({
          kind: tr.kind,
          stoppedAt
        }))
      : [];

    await axios.post(`${RECORDING_VM_URL}/stop`, {
      sessionId,
      stoppedAt,
      tracks: payloadTracks
    });

    activeRecordings.delete(sessionId);
    return { success: true };

  } catch (err: any) {
    console.error("❌ stopRecordingBridge error:", err?.message ?? err);
    return { success: false, error: err?.message ?? String(err) };
  }
}

// ------------------------------------------------------------
export async function getRecordingStatus() {
  try {
    const { data } = await axios.get(`${RECORDING_VM_URL}/status`);
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}
