import { getStore } from "@netlify/blobs";

export default async (req) => {
    // 1. Only allow GET requests
    if (req.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    // 2. Extract the sessionId from the query string (e.g., ?sessionId=atlanta-workshop)
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
        return new Response(JSON.stringify({ error: "Missing sessionId parameter" }), { 
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        // 3. Connect to the 'sessions' store
        const sessionsStore = getStore("sessions");
        
        // Use the proper .get(key, { type: "json" }) method!
        const sessionData = await sessionsStore.get(sessionId, { type: "json" });

        if (!sessionData) {
            return new Response(JSON.stringify({ error: "Session not found" }), { 
                status: 404,
                headers: { "Content-Type": "application/json" } 
            });
        }

        // 4. Return ONLY the public-safe data
        return new Response(JSON.stringify({
            title: sessionData.title,
            sessionId: sessionData.sessionId
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Error fetching session:", error);
        return new Response(JSON.stringify({ error: "Server Error" }), { 
            status: 500,
            headers: { "Content-Type": "application/json" } 
        });
    }
};