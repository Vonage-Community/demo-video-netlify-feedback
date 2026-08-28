import { getStore } from "@netlify/blobs";

export default async (req) => {
    // Only allow POST requests
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const body = await req.json();

        // Basic validation to ensure we have the minimum required data
        if (!body.sessionId || !body.consent) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), {
                status: 400
            });
        }

        const sessionsStore = getStore("sessions");
        const sessionExists = await sessionsStore.get(body.sessionId, { type: "json" });

        if (!sessionExists) {
            return new Response(JSON.stringify({ error: "Invalid session ID. Cannot submit feedback." }), {
                status: 403,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Connect to the "feedback" Blob store
        const feedbackStore = getStore("feedback");

        // Generate a unique ID for this specific review
        const feedbackId = crypto.randomUUID();

        // Construct the payload matching your index.html form names
        const feedbackData = {
            sessionId: body.sessionId,
            name: body.name || "Anonymous",
            socialHandle: body.socialHandle || "",
            socialPlatform: body.socialPlatform || "",
            rating: body.rating || null,
            textFeedback: body.textFeedback || "",
            archiveId: body.archiveId || null, // The Vonage Video Archive ID
            consentGranted: body.consent === "on",
            submittedAt: new Date().toISOString()
        };

        // Save to Netlify Blobs as JSON
        await feedbackStore.setJSON(feedbackId, feedbackData);

        return new Response(JSON.stringify({ success: true, id: feedbackId }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Error saving feedback:", error);
        return new Response(JSON.stringify({ error: "Failed to save feedback" }), {
            status: 500
        });
    }
};