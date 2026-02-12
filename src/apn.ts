import { Request, Response, NextFunction, Handler } from 'express';
import apn, { Notification, Provider as ApnProviderInstance, Responses as ApnResponses } from 'node-apn';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './misc';

// --- Type Definitions ---

/**
 * Configuration for the APNs Provider.
 * Ensure sensitive details (key path, keyId, teamId) are loaded securely, e.g., via environment variables.
 */
export interface ApnConfig {
    token: {
        key: string;      // Path to your .p8 key file
        keyId: string;    // Your Key ID
        teamId: string;   // Your Team ID
    };
    production: boolean; // true for production APNs, false for development/sandbox
    topic: string;       // Your app's bundle ID + .voip (e.g., com.yourapp.voip)
}

/**
 * Data required for the VoIP push notification payload.
 * This data will be received by your iOS app's PushKit delegate.
 */
export interface VoipCallData {
    uuid: string;         // Unique call identifier (essential for CallKit)
    callerName: string;   // Name of the caller to display
    roomId: string;       // Identifier for the call room/session
    teacherToken?: string; // Optional: Application-specific token (e.g., auth, user role)
    hasVideo?: boolean;    // Indicates if the call includes video (defaults to true if omitted)
}

/**
 * Structure of the expected request body for the /api/initiate-call endpoint.
 */
export interface InitiateCallRequestBody {
    recipientId: string;  // Identifier for the user receiving the call
    callerName: string;
    roomId: string;
    teacherToken?: string;
    hasVideo?: boolean;
}

/**
 * Defines the required signature for a function that retrieves a user's VoIP push token.
 * This function should interact with your user database or data store.
 * It must return the token string if found, or null otherwise.
 */
export type GetUserVoipToken = (userId: string) => Promise<string | null>;

/**
 * Type alias for the APN Provider instance from node-apn.
 */
export type ApnProvider = ApnProviderInstance;

export async function UpdateApnToken(req: Request, res: Response) {
    try {
        const { apnToken, endUsersId } = req.body
        await prisma.endUsers.update({ where: { id: endUsersId }, data: { apnToken } })
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}




// --- APNs Service Logic ---

/**
 * Creates and configures the APN Provider instance.
 * This should typically be called once when your server starts.
 * @param config - The APNs configuration object.
 * @returns The initialized APN Provider instance.
 * @throws Error if configuration seems invalid (e.g., missing essential parts).
 */
export function createApnProvider(config: ApnConfig): ApnProvider {
    // Basic validation
    if (!config || !config.token || !config.token.key || !config.token.keyId || !config.token.teamId || !config.topic) {
        throw new Error('Invalid APNs configuration: Missing required fields (token.key, token.keyId, token.teamId, topic).');
    }
    // Consider adding a check here to see if the key file actually exists using fs.existsSync(config.token.key)

    const options = {
        token: {
            key: config.token.key,       // Path to your .p8 key file
            keyId: config.token.keyId,   // Your Key ID
            teamId: config.token.teamId, // Your Team ID
        },
        production: config.production, // Use production or sandbox APNs endpoint
    };

    try {
        const apnProvider = new apn.Provider(options);
        console.log(`APN Provider initialized. Environment: ${config.production ? 'production' : 'development'}. Topic: ${config.topic}`);

        // Optional: Listen for transmission errors globally (might catch deeper issues)
        apnProvider.on('error', (err) => {
            console.error('[APN Provider Error] General provider error:', err);
        });
        apnProvider.on('transmissionError', (errCode, _notification, recipient) => {
            console.error(`[APN Provider Error] Transmission Error Code ${errCode} for token ${recipient?.substring(0, 10)}...`);
        });

        return apnProvider;
    } catch (initError: any) {
        console.error('[APN Provider Error] Failed to initialize APN Provider:', initError);
        throw new Error(`APN Provider initialization failed: ${initError.message}`);
    }
}

/**
 * Constructs and sends a single VoIP push notification.
 *
 * @param apnProvider - The initialized APN provider instance.
 * @param topic - The target application topic (e.g., com.yourapp.voip). Should match provider config.
 * @param voipToken - The recipient device's VoIP push token (obtained via PushKit).
 * @param callData - The payload data for the notification.
 * @returns A promise resolving with the APNs response object.
 * @throws Error if sending fails.
 */
export async function sendVoipCallNotification(
    apnProvider: ApnProvider,
    topic: string,
    voipToken: string,
    callData: VoipCallData
): Promise<ApnResponses> { // Use ApnResponses type from node-apn
    if (!voipToken) {
        throw new Error("VoIP token cannot be empty or null.");
    }
    if (!callData || !callData.uuid) {
        throw new Error("Call data with a valid UUID is required.");
    }

    try {
        const notification = new Notification();

        // --- Essential VoIP Push Settings ---
        notification.pushType = 'voip'; // Critical: Identifies this as a VoIP push
        notification.topic = topic;     // Critical: Must match your app bundle ID + .voip suffix

        // --- Payload ---
        // This data is received by your iOS app's PushKit delegate
        notification.payload = {
            uuid: callData.uuid,
            callerName: callData.callerName || 'Unknown Caller', // Provide default if necessary
            roomId: callData.roomId,
            // Only include optional fields if they have a value
            ...(callData.teacherToken && { teacherToken: callData.teacherToken }),
            hasVideo: callData.hasVideo ?? true, // Default to true if undefined/null
        };

        notification.priority = 10; // VoIP pushes should be high priority (10)

        // --- Log Before Sending ---
        console.log(`Attempting to send VoIP push. Topic: ${topic}, Token: ${voipToken.substring(0, 10)}..., UUID: ${callData.uuid}`);
        // console.log('Payload:', JSON.stringify(notification.payload)); // Be careful logging sensitive data

        // --- Send Notification ---
        const result = await apnProvider.send(notification, voipToken);

        // --- Log APNs Result ---
        if (result.sent.length > 0) {
            console.log(`VoIP push sent successfully. APNs ID: ${result.sent[0].device}`); // device here is the token
        }
        if (result.failed.length > 0) {
            // Log detailed failure information
            const failure = result.failed[0];
            const reason = failure.response?.reason || failure.error?.message || failure.status || 'Unknown reason';
            console.log(result.failed)
            console.error(`VoIP push failed for token ${failure.device.substring(0, 10)}... Status: ${failure.status}, Reason: ${reason}`);
            // IMPORTANT: Handle 'BadDeviceToken' or 'Unregistered' by removing the token from your database.
            if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
                console.warn(`Action needed: Token ${failure.device.substring(0, 10)}... is invalid. Remove from database.`);
                // Add your logic here to trigger token removal based on `failure.device` (which is the token)
            }
        }

        return result;

    } catch (error: any) {
        console.error(`[VoIP Send Error] Error constructing or sending VoIP notification for token ${voipToken.substring(0, 10)}...:`, error);
        // Re-throw a more specific error or handle appropriately
        throw new Error(`Failed to send VoIP notification: ${error.message || error}`);
    }
}

/**
 * Factory function to create the Express handler for initiating a VoIP call.
 * This promotes testability and separation of concerns by injecting dependencies.
 *
 * @param apnProvider - The initialized APN provider instance.
 * @param apnTopic - The APNs topic string (e.g., com.yourapp.voip).
 * @param getUserVoipToken - The async function to retrieve a user's VoIP token. Defaults to a placeholder.
 * @returns An Express Handler function (middleware).
 */
export function createInitiateCallHandler(
    apnProvider: ApnProvider,
    apnTopic: string,
    getUserVoipToken: GetUserVoipToken  // Use injected or placeholder function
): Handler { // Return type is Express Handler

    // Return the actual middleware function that Express will use
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Input Validation (using basic checks, consider a library like zod/joi for complex validation)
        const body = req.body as InitiateCallRequestBody;
        const { recipientId, callerName, roomId, teacherToken, hasVideo } = body;

        if (!recipientId || !callerName || !roomId) {
            res.status(400).json({ success: false, message: 'Bad Request: Missing required fields (recipientId, callerName, roomId).' });
            return;
        }

        console.log(`[API Initiate Call] Request received for recipientId: ${recipientId}`);

        try {
            // 1. Fetch Recipient's VoIP Token
            const voipToken = await getUserVoipToken(recipientId);

            console.log("voip token ", voipToken)

            if (!voipToken) {
                console.warn(`[API Initiate Call] VoIP token not found for recipientId: ${recipientId}. Cannot initiate call.`);
                // 404 indicates the target resource (the user's token) was not found
                res.status(404).json({ success: false, message: 'Recipient user not found or does not have a registered VoIP token.' });
                return;
            }

            // 2. Generate a Unique Call ID (UUID)
            const callUUID = uuidv4();
            console.log(`[API Initiate Call] Generated Call UUID: ${callUUID}`);

            // 3. Prepare Payload Data
            const callData: VoipCallData = {
                uuid: callUUID,
                callerName,
                roomId,
                teacherToken, // Include if provided in request body
                hasVideo: hasVideo ?? true, // Default to video call if not specified
            };

            // 4. Send the VoIP Push Notification
            const apnsResult = await sendVoipCallNotification(apnProvider, apnTopic, voipToken, callData);

            // 5. Handle APNs Response & Respond to API Caller
            if (apnsResult.failed.length > 0) {
                // If APNs reported failure for this token
                const failure = apnsResult.failed[0];
                const reason = failure.response?.reason || failure.error?.message || failure.status || 'Unknown APNs Error';
                console.error(`[API Initiate Call] Failed to send APNs push for UUID ${callUUID}. Reason: ${reason}`);

                res.status(502).json({ // 502 Bad Gateway might be appropriate if APNs fails
                    success: false,
                    message: `Failed to deliver call notification via APNs: ${reason}`,
                    callUUID: callUUID // Include UUID for tracking/debugging
                });
                return;
            }

            // If apnsResult.sent has entries, it means APNs accepted the notification
            console.log(`[API Initiate Call] Successfully sent VoIP push instruction for call UUID: ${callUUID}.`);
            res.status(200).json({ success: true, callUUID: callUUID });

        } catch (error: any) {
            console.error(`[API Initiate Call] Unexpected error during call initiation for recipient ${recipientId}:`, error);
            // Pass error to the global Express error handler
            next(error);
        }
    };
}

// --- How to Use in your main app.ts/server.ts ---
/*

import express from 'express';
import dotenv from 'dotenv';
import { createApnProvider, createInitiateCallHandler, ApnConfig, GetUserVoipToken } from './voipPushService'; // Adjust path as needed

dotenv.config(); // Load .env variables

const app = express();
app.use(express.json());

// --- 1. Configure APNs ---
const apnConfig: ApnConfig = {
  token: {
    key: process.env.APNS_KEY_PATH!, // Use non-null assertion or check existence
    keyId: process.env.APNS_KEY_ID!,
    teamId: process.env.APNS_TEAM_ID!,
  },
  production: process.env.NODE_ENV === 'production',
  topic: process.env.APNS_VOIP_TOPIC!, // e.g., com.yourcompany.yourapp.voip
};

// --- 2. Create APNs Provider (Do this once on startup) ---
// Add error handling around this in case config is bad or file not found
let apnProvider;
try {
     apnProvider = createApnProvider(apnConfig);
} catch (e) {
    console.error("FATAL: Could not create APN provider. Server cannot start.", e);
    process.exit(1);
}


// --- 3. Implement Your Actual Token Retrieval Logic ---
const getRealUserVoipToken: GetUserVoipToken = async (userId: string): Promise<string | null> => {
    console.log(`Fetching token for user ${userId} from REAL database...`);
    // Replace with your actual database lookup logic
    // Example:
    // const user = await YourUserModel.findById(userId);
    // return user?.voipPushToken || null;
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async DB call
    if (userId === 'real_user_123') return 'a_valid_token_from_db_for_user_123';
    return null;
};

// --- 4. Create the Handler ---
const initiateCallHandler = createInitiateCallHandler(
  apnProvider,
  apnConfig.topic,
  getRealUserVoipToken // Inject your real function here
);

// --- 5. Register the Route ---
app.post('/api/initiate-call', initiateCallHandler);

// --- Add Global Error Handler ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// --- Graceful Shutdown ---
const shutdown = () => {
    console.log('Closing server...');
    server.close(() => {
        console.log('HTTP server closed.');
        if (apnProvider) {
            console.log('Shutting down APN provider...');
            apnProvider.shutdown(); // Close APNs connections
        }
        process.exit(0);
    });
    // Force exit after timeout
     setTimeout(() => { process.exit(1); }, 10000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

*/
