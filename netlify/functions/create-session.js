import { getStore } from "@netlify/blobs";

export default async (req) => {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
        return new Response("Unauthorized", { status: 401 });
    }

    // --- THE DEV MODE BYPASS ---
    // If we are running locally in Codespaces AND we get the mock token, let them through
    if (process.env.NETLIFY_DEV === 'true' && authHeader === 'Bearer DEV_MOCK_TOKEN') {
        return createSession(req);
    }

    // --- PRODUCTION JWT VERIFICATION ---
    const token = authHeader.split(" ")[1];
    try {
        const payloadBase64Url = token.split('.')[1];
        const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jwtPayload = JSON.parse(atob(payloadBase64));

        const loggedInUser = jwtPayload.email;
        const allowedUser = process.env.ADMIN_EMAIL;

        if (loggedInUser !== allowedUser) {
            return new Response(JSON.stringify({ error: "Forbidden: You are not the instructor." }), { status: 403 });
        }

        return createSession(req);

    } catch (error) {
        return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401 });
    }

};
// --- HELPER FUNCTION: Create a Session ---
async function createSession(req) {
    try {
        const { title, sessionId } = await req.json();
        const sessionsStore = getStore("sessions");

        await sessionsStore.setJSON(sessionId, {
            title,
            sessionId,
            createdAt: new Date().toISOString()
        });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to save session" }), { status: 500 });
    }

}