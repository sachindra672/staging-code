import fs from "fs";
import path from "path";
import { Worker, Router } from "mediasoup/node/lib/types";
import { getWorker } from "./getWorker";
import { config } from "../config/config";
import {
    getOpenSessionRoom,
    setOpenSessionRoom,
    deleteOpenSessionRoom,
    OpenSessionRoom,
} from "./openSessionRoomManager";

const logDir = path.join(__dirname, "logs");
const logFilePath = path.join(logDir, "openSessionWorkerRoom.log");

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const workerOpenSessionMap = new Map<number, string>();

const logAssignment = (message: string) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`, { encoding: "utf-8" });
};

const pickWorkerForOpenSession = async (workers: Worker[]): Promise<Worker> => {
    const activeRoomSessions = new Set(workerOpenSessionMap.values());

    const freeWorkers = workers.filter((worker) => !workerOpenSessionMap.has(worker.pid));
    if (freeWorkers.length > 0) {
        return getWorker(freeWorkers);
    }

    // All workers currently host open sessions. Use least-loaded worker based on number of rooms.
    const roomCountPerWorker = new Map<number, number>();

    for (const worker of workers) {
        roomCountPerWorker.set(worker.pid, 0);
    }

    for (const sessionId of activeRoomSessions) {
        const workerPid = [...workerOpenSessionMap.entries()].find(
            ([, sid]) => sid === sessionId,
        )?.[0];
        if (workerPid !== undefined) {
            roomCountPerWorker.set(workerPid, (roomCountPerWorker.get(workerPid) ?? 0) + 1);
        }
    }

    let targetWorker = workers[0];
    let minRooms = roomCountPerWorker.get(targetWorker.pid) ?? 0;

    for (const worker of workers) {
        const workerRoomCount = roomCountPerWorker.get(worker.pid) ?? 0;
        if (workerRoomCount < minRooms) {
            minRooms = workerRoomCount;
            targetWorker = worker;
        }
    }

    return targetWorker;
};

export const createOpenSessionRoomWithBalancedWorker = async (
    sessionId: string,
    workers: Worker[],
): Promise<OpenSessionRoom> => {
    const existingRoom = getOpenSessionRoom(sessionId);
    if (existingRoom) {
        return existingRoom;
    }

    const worker = await pickWorkerForOpenSession(workers);

    const router: Router = await worker.createRouter({
        mediaCodecs: config.routerMediaCodecs,
    });

    const room: OpenSessionRoom = {
        router,
        peers: new Map(),
        pendingSpeakRequests: new Map(),
    };

    setOpenSessionRoom(sessionId, room);

    workerOpenSessionMap.set(worker.pid, sessionId);
    logAssignment(`Open session ${sessionId} assigned to worker ${worker.pid}`);

    return room;
};

export const removeOpenSessionRoom = (sessionId: string) => {
    const workerEntry = [...workerOpenSessionMap.entries()].find(([, sid]) => sid === sessionId);
    if (workerEntry) {
        const [pid] = workerEntry;
        workerOpenSessionMap.delete(pid);
        logAssignment(`Open session ${sessionId} removed from worker ${pid}`);
    }

    deleteOpenSessionRoom(sessionId);
};

