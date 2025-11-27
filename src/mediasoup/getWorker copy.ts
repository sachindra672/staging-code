import { Worker } from 'mediasoup/node/lib/types';

export const getWorker = (workers: Worker[]) => {
    return new Promise(async (resolve, _reject) => {
        const workersLoad = workers.map(worker => {
            return new Promise(async (resolve, _reject) => {
                const stats = await worker.getResourceUsage();

                const cpuUsage = stats.ru_utime + stats.ru_stime;
                resolve(cpuUsage)
            })
        })
        const workersLoadClac = await Promise.all(workersLoad) as number[];
        let leastLoadedWorker = 0;
        let leastWorkerLoad = Infinity;
        for (let i = 0; i < workersLoadClac.length; i++) {
            if (workersLoadClac[i] < leastWorkerLoad) {
                leastWorkerLoad = workersLoadClac[i];
                leastLoadedWorker = i;
            }
        }
        resolve(workers[leastLoadedWorker]);
    })
}