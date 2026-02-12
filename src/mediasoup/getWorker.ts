import { Worker } from 'mediasoup/node/lib/types';

type WorkerUsage = {
    lastCpu: number;
    lastTime: number;
};

const workerCpuHistory = new Map<number, WorkerUsage>();

export const getWorker = async (workers: Worker[]) => {
    const workerLoads: number[] = [];

    for (const worker of workers) {
        const stats = await worker.getResourceUsage();
        const currentCpu = stats.ru_utime + stats.ru_stime;
        const now = Date.now();

        const prev = workerCpuHistory.get(worker.pid);
        let deltaCpuPerSec = 0;

        if (prev) {
            const elapsedMs = now - prev.lastTime;
            const deltaCpu = currentCpu - prev.lastCpu;
            deltaCpuPerSec = (deltaCpu / 1_000_000) / (elapsedMs / 1000);
        } else {
            deltaCpuPerSec = 0.1; 
        }

        workerCpuHistory.set(worker.pid, { lastCpu: currentCpu, lastTime: now });


        workerLoads.push(deltaCpuPerSec);
    }

    let minIndex = 0;
    let minLoad = Infinity;
    for (let i = 0; i < workerLoads.length; i++) {
        if (workerLoads[i] < minLoad) {
            minLoad = workerLoads[i];
            minIndex = i;
        }
    }

    return workers[minIndex];
};
