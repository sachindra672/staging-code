import { getWorker } from './getWorker';
import { rooms } from './roomManager';
import { config } from '../config/config';
import { Worker } from 'mediasoup/node/lib/types';
import { EventEmitter } from 'events';

export const createRoomWithBalancedWorker = async (sessionId: string, workers: Worker[]) => {
    if (rooms.has(sessionId)) return rooms.get(sessionId);

    const worker = await getWorker(workers);
    const router = await (worker as Worker).createRouter({
        mediaCodecs: config.routerMediaCodecs,
    });

    const room = {
        router,
        peers: new Map(),
        pendingSpeakRequests: new Map(),
        events: new EventEmitter(),
    };

    rooms.set(sessionId, room);
    return room;
};
