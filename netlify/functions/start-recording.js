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
    const params = await req.json();
    const { vonageSessionId, workshopSessionId } = params;
    
    const archiveOptions = {
      name: workshopSessionId, 
      layout: { type: "bestFit" },
      resolution: "1920x1080",
    };

    // Start Archive
    const archive = await vonage.video.startArchive(vonageSessionId, archiveOptions);

    return new Response(JSON.stringify({ archiveId: archive.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error starting archive: ", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};