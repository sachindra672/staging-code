// import { getWorker } from './getWorker';
// import { rooms } from './roomManager';
// import { config } from '../config/config';
// import { Worker } from 'mediasoup/node/lib/types';

// export const createRoomWithBalancedWorker = async (sessionId: string, workers: Worker[]) => {
//     if (rooms.has(sessionId)) return rooms.get(sessionId);

//     const worker = await getWorker(workers);
//     const router = await (worker as Worker).createRouter({
//         mediaCodecs: config.routerMediaCodecs,
//     });

//     const room = {
//         router,
//         peers: new Map(),
//         pendingSpeakRequests: new Map(),
//     };

//     rooms.set(sessionId, room);
//     return room;
// };

import { getWorker } from './getWorker';
import { rooms } from './roomManager';
import { config } from '../config/config';
import { Worker, Router } from 'mediasoup/node/lib/types';
import fs from 'fs';
import path from 'path';

export type Room = {
    router: Router;
    peers: Map<string, any>;
    pendingSpeakRequests: Map<string, any>;
};

const logDir = path.join(__dirname, 'logs'); 
const logFilePath = path.join(logDir, 'workerRoom.log');


if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const workerRoomMap = new Map<number, string>(); // worker.pid -> sessionId


const logAssignment = (message: string) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`, { encoding: 'utf-8' });
};


const getStrictWorker = async (workers: Worker[]): Promise<Worker> => {
    const freeWorkers = workers.filter(worker => !workerRoomMap.has(worker.pid));
    return freeWorkers.length > 0 ? await getWorker(freeWorkers) : await getWorker(workers);
};

export const createRoomWithBalancedWorker = async (sessionId: string, workers: Worker[]): Promise<Room> => {
    if (rooms.has(sessionId)) return rooms.get(sessionId)!;

    const worker = await getStrictWorker(workers);

    
    const router = await worker.createRouter({
        mediaCodecs: config.routerMediaCodecs,
    });

    workerRoomMap.set(worker.pid, sessionId);
    logAssignment(`Room ${sessionId} assigned to worker ${worker.pid}`);

    const room: Room = {
        router,
        peers: new Map(),
        pendingSpeakRequests: new Map(),
    };

    rooms.set(sessionId, room);
    console.log(`Room ${sessionId} created on worker ${worker.pid}`);

    return room;
};

export const removeRoom = (sessionId: string) => {
    const room = rooms.get(sessionId);
    if (!room) return;

    // Find worker hosting this room
    const workerPid = [...workerRoomMap.entries()].find(([_pid, sid]) => sid === sessionId)?.[0];
    if (workerPid) {
        workerRoomMap.delete(workerPid);
        logAssignment(`Room ${sessionId} removed from worker ${workerPid}`);
    }

    rooms.delete(sessionId);
    console.log(`Room ${sessionId} removed from worker ${workerPid}`);
};
