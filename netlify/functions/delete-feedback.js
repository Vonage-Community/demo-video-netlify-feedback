import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    // Only allow DELETE requests
    if (req.method !== "DELETE") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
        return new Response("Unauthorized", { status: 401 });
    }

    // --- THE DEV MODE BYPASS ---
    // If we are running locally in Codespaces AND we get the mock token, let them through
    if (process.env.NETLIFY_DEV === 'true' && authHeader === 'Bearer DEV_MOCK_TOKEN') {
        return deleteFeedback(req);
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

        return deleteFeedback(req);

    } catch (error) {
        return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401 });
    }

};

// --- HELPER FUNCTION: Delete Feedback ---
async function deleteFeedback(req) {
    try {
        const { id } = await req.json();
        
        if (!id) {
            return new Response(JSON.stringify({ error: "Missing feedback ID" }), { status: 400 });
        }

        const store = getStore("feedback");
        
        // Netlify Blobs delete function
        await store.delete(id);

        return new Response(JSON.stringify({ success: true }), { 
            status: 200, 
            headers: { "Content-Type": "application/json" } 
        });

    } catch (error) {
        console.error("Error deleting feedback:", error);
        return new Response(JSON.stringify({ error: "Failed to delete feedback" }), { status: 500 });
    }

}