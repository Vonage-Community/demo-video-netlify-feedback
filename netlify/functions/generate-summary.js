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
        return generateAISummary(req);
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

        return generateAISummary(req);

    } catch (error) {
        return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401 });
    }


};

// --- HELPER FUNCTION: Generate AI Summary ---
async function generateAISummary(req) {
    try {
        const { sessionName, comments } = await req.json();
        console.log("Generating summary for session:", sessionName);
        console.log("Number of comments received:", comments ? comments.length : 0);
        console.log("Comments:", comments);

        if (!comments || comments.length === 0) {
            return new Response(JSON.stringify({ summary: "No written feedback to summarize." }), { status: 200 });
        }

        // Define your models in priority order
        const fallbackChain = [
            "google/gemma-3-4b-it",
            "meta-llama/llama-3.1-8b-instruct"
        ];

        const messages = [
            { role: "system", content: "Summarize this workshop feedback into 2 concise sentences highlighting pros and cons." },
            { role: "user", content: `Session: ${sessionName}\nFeedback:\n${comments.join('\n')}` }
        ];

        let finalAiData = null;
        let finalStatus = 500;

        // Loop through the models one by one
        for (const currentModel of fallbackChain) {
            const aiResponse = await fetch(`${process.env.OPENROUTER_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
                },
                body: JSON.stringify({
                    model: currentModel, // Standard string format to satisfy Netlify AI Gateway
                    messages: messages,
                    max_tokens: 150
                })
            });

            finalAiData = await aiResponse.json();
            finalStatus = aiResponse.status;

            // If successful, break out of the loop immediately
            if (aiResponse.ok) {
                break;
            }

            // If rate-limited (429), log it and let the loop try the next model
            if (aiResponse.status === 429) {
                console.warn(`Model ${currentModel} is busy. Trying fallback...`);
                continue;
            }

            // If it fails for any OTHER reason (e.g., bad auth), stop trying and return the error
            break;
        }

        // After the loop finishes, check if we ultimately failed
        if (finalStatus !== 200) {
            return new Response(JSON.stringify({
                error: finalAiData.error?.message || "Failed to generate summary after trying all models."
            }), {
                status: finalStatus,
                headers: { "Content-Type": "application/json" }
            });
        }

        const summary = finalAiData.choices[0].message.content;

        // 2. Cache the result in Netlify Blobs
        const summariesStore = getStore("session-summaries");

        await summariesStore.setJSON(sessionName, {
            aiSummary: summary,
            summarizedCount: comments.length
        });

        return new Response(JSON.stringify({ summary }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("AI Generation Error:", error);
        return new Response(JSON.stringify({ error: "Failed to generate summary" }), { status: 500 });
    }

}