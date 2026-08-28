import { Vonage } from "@vonage/server-sdk";
import { Video } from "@vonage/video";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const { VONAGE_APP_ID, VONAGE_PRIVATE_KEY64 } = process.env;
  const privateKey = Buffer.from(VONAGE_PRIVATE_KEY64, "base64");
  
  const credentials = { applicationId: VONAGE_APP_ID, privateKey };
  const vonage = new Vonage(credentials);
  vonage.video = new Video(credentials);

  try {
    // 1. Create a brand new, routed session
    const session = await vonage.video.createSession({ mediaMode: "routed" });
    
    // 2. Generate the token
    const token = vonage.video.generateClientToken(session.sessionId, {
      role: "publisher",
      expireTime: Math.floor(Date.now() / 1000) + 3600
    });

    return new Response(JSON.stringify({ 
      applicationId: VONAGE_APP_ID,
      vonageSessionId: session.sessionId, 
      token 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error creating session: ", error);
    return new Response(JSON.stringify({ error: "Setup failed: " + error.message }), { status: 500 });
  }
};