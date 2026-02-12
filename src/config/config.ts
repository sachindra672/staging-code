import { WorkerLogLevel, WorkerLogTag, RtpCodecCapability } from 'mediasoup/node/lib/types';

export const config = {
    workerSettings: {
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
        logLevel: 'warn' as WorkerLogLevel,
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'] as WorkerLogTag[],
    },

    webRtcTransportSettings: {
        listenIps: [
            {
                ip: '0.0.0.0',
                announcedIp: '34.87.134.253'
            }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        maxIncomingBitrate: 1500000,
        maxOutgoingBitrate: 600000,
        initialAvailableOutgoingBitrate: 1000000,
    },

    routerMediaCodecs: [
        {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
        },
        {
            kind: 'video',
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters: {
                'x-google-start-bitrate': 1000,
                'x-google-min-bitrate': 300,
                'x-google-max-bitrate': 3000,
            },
            scalabilityMode: 'S3T3',
        },
        {
            kind: 'video',
            mimeType: 'video/H264',
            clockRate: 90000,
            parameters: {
                'packetization-mode': 1,
                'profile-level-id': '4d0032',
                'level-asymmetry-allowed': 1,
            },
        },
    ] as RtpCodecCapability[],
};

// Updated server-side transport creation function
export const createWebRtcTransport = async (router: any) => {
    try {
        const transport = await router.createWebRtcTransport({
            ...config.webRtcTransportSettings,
            // Additional transport-specific settings
            appData: {},
        });

        console.log('Transport created successfully:', {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        });

        return {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
        };
    } catch (error) {
        console.error('Failed to create WebRTC transport:', error);
        throw error;
    }
};