import fs from "fs";
import path from "path";
import { Server, Socket } from "socket.io";

type ChatVisibilityMode = "public" | "student-to-teacher";

interface ChatSettings {
    slowModeInterval: number;
    lastMessageTimestamps: Map<string, number>;
    mutedUsers: Map<string, number>;
    isGlobalMute: boolean;
    teacherBannedWords: string[];
    chatMode: ChatVisibilityMode;
    banViolationCount: Map<string, number>;
}

const predefinedBannedWords: string[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../config/bannedWords.json"), "utf-8")
);

const openSessionChatSettings = new Map<string, ChatSettings>();
const AUTO_MUTE_THRESHOLD = 3;
const AUTO_MUTE_DURATION_SEC = 300;

export const setupOpenSessionChatHandlers = (
    io: Server,
    socket: Socket,
    sessionId: string
) => {
    const user = (socket as any).user;
    if (!user) {
        console.log(`User not found for socket ${socket.id}`);
        return;
    }

    if (!openSessionChatSettings.has(sessionId)) {
        console.log(`Initializing open session chat settings for session ${sessionId}`);
        openSessionChatSettings.set(sessionId, {
            slowModeInterval: 0,
            lastMessageTimestamps: new Map(),
            mutedUsers: new Map(),
            isGlobalMute: false,
            teacherBannedWords: [],
            chatMode: "public",
            banViolationCount: new Map(),
        });
    }

    const settings = openSessionChatSettings.get(sessionId)!;

    const chatMessageHandler = (message: string) => {
        console.log(`Open session chat message from ${user.info.email}: ${message}`);
        const now = Date.now();
        const userId = user.info.uuid;

        if (settings.isGlobalMute && user.role !== "mentor") {
            return socket.emit("chat-error", "Chat is globally muted.");
        }

        const muteUntil = settings.mutedUsers.get(userId);
        if (muteUntil && now < muteUntil) {
            return socket.emit("chat-error", "You are muted.");
        }

        if (settings.slowModeInterval > 0) {
            const lastSent = settings.lastMessageTimestamps.get(userId) || 0;
            if (now - lastSent < settings.slowModeInterval * 1000) {
                return socket.emit(
                    "chat-error",
                    `Slow mode: wait ${Math.ceil(
                        (settings.slowModeInterval * 1000 - (now - lastSent)) / 1000
                    )}s.`
                );
            }
            settings.lastMessageTimestamps.set(userId, now);
        }

        const lowerMsg = message.toLowerCase();
        const allBannedWords = [
            ...predefinedBannedWords,
            ...settings.teacherBannedWords,
        ];
        const wordsInMessage = lowerMsg.replace(/[^\w\s]/g, "").split(/\s+/);
        const matchedWord = allBannedWords.find((b) =>
            wordsInMessage.includes(b.toLowerCase())
        );

        if (matchedWord) {
            const count = (settings.banViolationCount.get(userId) || 0) + 1;
            settings.banViolationCount.set(userId, count);

            if (count >= AUTO_MUTE_THRESHOLD) {
                const muteUntilTs = now + AUTO_MUTE_DURATION_SEC * 1000;
                settings.mutedUsers.set(userId, muteUntilTs);
                settings.banViolationCount.set(userId, 0);
                socket.emit(
                    "chat-error",
                    `You used banned words too many times. Muted for ${AUTO_MUTE_DURATION_SEC / 60
                    } minutes.`
                );
                return;
            }

            socket.emit(
                "chat-warning",
                `Warning: Inappropriate language detected (${count}/3). Avoid such words.`
            );
            return;
        }

        const msgPayload = {
            userId,
            name: user.info.name,
            message,
            timestamp: now,
        };

        if (settings.chatMode === "public") {
            io.to(sessionId).emit("chat-message", msgPayload);
        } else if (settings.chatMode === "student-to-teacher") {
            if (user.role === "mentor") {
                io.to(sessionId).emit("chat-message", msgPayload);
            } else {
                const teacherSockets = Array.from(io.sockets.sockets.values()).filter(
                    (s) => (s as any)?.user?.role === "mentor" && s.rooms.has(sessionId)
                );
                teacherSockets.forEach((s) => {
                    s.emit("chat-message", { ...msgPayload, private: true });
                });
                socket.emit("chat-message", { ...msgPayload, private: true });
            }
        }
    };

    const reactionHandler = ({ emoji }: { emoji: string }) => {
        const now = Date.now();
        const userId = user.info.uuid;

        const lastReactionTime = settings.lastMessageTimestamps.get(userId) || 0;
        if (now - lastReactionTime < 1000) {
            return socket.emit("reaction-error", "Too many reactions too quickly.");
        }

        settings.lastMessageTimestamps.set(userId, now);

        const payload = {
            userId,
            name: user.info.name,
            emoji,
            timestamp: now,
        };

        io.to(sessionId).emit("reaction", payload);
    };

    const setBanWordsHandler = ({ words }: { words: string[] }) => {
        if (user.role !== "mentor") return;
        settings.teacherBannedWords = words;
        socket.emit("ban-words-updated", words);
    };

    const setSlowModeHandler = ({ interval }: { interval: number }) => {
        if (user.role !== "mentor") return;
        settings.slowModeInterval = interval;
        io.to(sessionId).emit("slow-mode-updated", interval);
    };

    const muteUserHandler = ({
        userId,
        duration,
    }: {
        userId: string;
        duration: number;
    }) => {
        if (user.role !== "mentor") return;
        const muteUntilTs = Date.now() + duration * 1000;
        settings.mutedUsers.set(userId, muteUntilTs);
        socket.emit("user-muted", { userId, until: muteUntilTs });
    };

    const unmuteUserHandler = ({ userId }: { userId: string }) => {
        if (user.role !== "mentor") return;
        settings.mutedUsers.delete(userId);
        socket.emit("user-unmuted", { userId });
    };

    const setGlobalMuteHandler = ({ muted }: { muted: boolean }) => {
        if (user.role !== "mentor") return;
        settings.isGlobalMute = muted;
        io.to(sessionId).emit("global-mute-updated", muted);
    };

    const setChatModeHandler = ({ mode }: { mode: ChatVisibilityMode }) => {
        if (user.role !== "mentor") return;
        settings.chatMode = mode;
        io.to(sessionId).emit("chat-mode-updated", mode);
    };

    socket.on("chat-message", chatMessageHandler);
    socket.on("reaction", reactionHandler);
    socket.on("set-ban-words", setBanWordsHandler);
    socket.on("set-slow-mode", setSlowModeHandler);
    socket.on("mute-user", muteUserHandler);
    socket.on("unmute-user", unmuteUserHandler);
    socket.on("set-global-mute", setGlobalMuteHandler);
    socket.on("set-chat-mode", setChatModeHandler);

    return () => {
        socket.off("chat-message", chatMessageHandler);
        socket.off("reaction", reactionHandler);
        socket.off("set-ban-words", setBanWordsHandler);
        socket.off("set-slow-mode", setSlowModeHandler);
        socket.off("mute-user", muteUserHandler);
        socket.off("unmute-user", unmuteUserHandler);
        socket.off("set-global-mute", setGlobalMuteHandler);
        socket.off("set-chat-mode", setChatModeHandler);
    };
};

