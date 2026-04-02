import { Client, type Session, type Socket } from '@heroiclabs/nakama-js';

// Initialize the Nakama client
const host = import.meta.env.VITE_NAKAMA_HOST || window.location.hostname || "127.0.0.1";
const port = import.meta.env.VITE_NAKAMA_PORT || "7350";
const USE_SSL = import.meta.env.VITE_NAKAMA_SSL === "true" || false;

export const nakamaClient = new Client("defaultkey", host, port, USE_SSL);

export let nakamaSession: Session | null = null;
export let nakamaSocket: Socket | null = null;

export const authenticate = async (username: string) => {
    // We use device auth for simplicity, with the username as a created device id
    try {
        let deviceId = localStorage.getItem("deviceId");
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem("deviceId", deviceId);
        }
        
        const session = await nakamaClient.authenticateDevice(deviceId, true, username);
        nakamaSession = session;
        
        // Update account with display name if it changed
        await nakamaClient.updateAccount(session, {
            display_name: username
        });
        
        return session;
    } catch (error) {
        console.error("Auth error", error);
        throw error;
    }
};

export const connectSocket = async () => {
    if (!nakamaSession) return null;
    try {
        nakamaSocket = nakamaClient.createSocket(USE_SSL, false);
        await nakamaSocket.connect(nakamaSession, true);
        return nakamaSocket;
    } catch (e) {
        console.error("Socket error", e);
        throw e;
    }
};

export const disconnectSocket = () => {
    if (nakamaSocket) {
        nakamaSocket.disconnect(false);
        nakamaSocket = null;
    }
}
