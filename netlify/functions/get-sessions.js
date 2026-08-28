import { getStore } from "@netlify/blobs";

export default async (req) => {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
        return new Response("Unauthorized", { status: 401 });
    }

    // --- THE DEV MODE BYPASS ---
    // If we are running locally in Codespaces AND we get the mock token, let them through
    if (process.env.NETLIFY_DEV === 'true' && authHeader === 'Bearer DEV_MOCK_TOKEN') {
        return fetchAndReturnBlobs();
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

        return fetchAndReturnBlobs();

    } catch (error) {
        return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401 });
    }
};

// --- HELPER FUNCTION: Fetch and Calculate ---
async function fetchAndReturnBlobs() {
    try {
        const feedbackStore = getStore("feedback");
        const { blobs } = await feedbackStore.list();

        let totalScore = 0;
        let feedbackCount = 0;
        const allFeedback = [];

        // Fetch the actual JSON data for each blob
        for (const blob of blobs) {
            const data = await feedbackStore.get(blob.key, { type: "json" });

            allFeedback.push({ id: blob.key, ...data });
            totalScore += parseInt(data.rating, 10);
            feedbackCount++;
        }

        const averageRating = feedbackCount > 0 ? (totalScore / feedbackCount).toFixed(1) : 0;

        const summariesStore = getStore("session-summaries");
        const { blobs: summaryBlobs } = await summariesStore.list();

        let sessionMeta = {};
        for (const blob of summaryBlobs) {
            // blob.key will be the sessionId (e.g., "atlanta-workshop")
            sessionMeta[blob.key] = await summariesStore.get(blob.key, { type: "json" });
        }

        const sessionsStore = getStore("sessions");
        const { blobs: sessionStoreBlobs } = await sessionsStore.list();

        let sessionDetails = {};
        for (const blob of sessionStoreBlobs) {
            sessionDetails[blob.key] = await sessionsStore.get(blob.key, { type: "json" });
        }

        const dashboardData = {
            average: averageRating,
            totalFeedback: feedbackCount,
            feedback: allFeedback,
            sessionMeta: sessionMeta,
            sessionDetails: sessionDetails
        };

        return new Response(JSON.stringify(dashboardData), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch blobs from storage" }), { status: 500 });
    }
}