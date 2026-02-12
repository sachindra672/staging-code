import os from 'os';
import { createWorker } from 'mediasoup';
import { config } from '../config/config';

export const createWorkers = () => new Promise(async (resolve, _reject) => {
    const totalThreads = os.cpus().length;
    const workers = [];

    for (let i = 0; i < totalThreads; i++) {
        const worker = await createWorker({
            rtcMinPort: config.workerSettings.rtcMinPort,
            rtcMaxPort: config.workerSettings.rtcMaxPort,
            logLevel: config.workerSettings.logLevel,
            logTags: config.workerSettings.logTags
        });

        worker.on('died', () => {
            console.error('Mediasoup worker has died. Exiting...');
            process.exit(1);
        });

        workers.push(worker);
    }

    resolve(workers);
});
