import { Vonage } from "@vonage/server-sdk";
import { Video } from "@vonage/video";

export default async (req) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Pull environment variables
  const { VONAGE_APP_ID, VONAGE_PRIVATE_KEY64 } = process.env;
  
  // Decode the base64 private key
  const privateKey = Buffer.from(VONAGE_PRIVATE_KEY64, "base64");
  
  const credentials = {
    applicationId: VONAGE_APP_ID,
    privateKey,
  };

  // Initialize Vonage client
  const vonage = new Vonage(credentials);
  vonage.video = new Video(credentials);

  try {
    // Parse the JSON body using standard Web APIs
    const params = await req.json();
    const { archiveId } = params;

    // Stop Archive
    const archive = await vonage.video.stopArchive(archiveId);

    // Return a standard Web Response
    return new Response(JSON.stringify({ status: "stopped", archiveId: archive.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error stopping archive: ", error);
    
    return new Response(JSON.stringify({ error: "stopArchive error: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};