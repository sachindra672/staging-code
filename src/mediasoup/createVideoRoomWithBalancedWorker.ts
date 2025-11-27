import { getWorker } from './getWorker';
import { config } from '../config/config';
import { Worker } from 'mediasoup/node/lib/types';
import { VcRoom, videoRooms } from './videocallRoomManager';

export const createVideoRoomWithBalancedWorker = async (callId: string, workers: Worker[]): Promise<VcRoom | undefined> => {
    if (videoRooms.has(callId)) return videoRooms.get(callId);

    const worker = await getWorker(workers);
    const router = await (worker as Worker).createRouter({
        mediaCodecs: config.routerMediaCodecs,
    });

    const room: VcRoom = {
        router,
        peers: new Map(),
    };

    videoRooms.set(callId, room);
    return room;
};


