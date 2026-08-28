import { Vonage } from "@vonage/server-sdk";
import { Video } from "@vonage/video";

export default async (req) => {
  // Only allow GET requests since this will be clicked from an anchor link
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Extract the archiveId from the URL query parameters
  const url = new URL(req.url);
  const archiveId = url.searchParams.get("archiveId");

  if (!archiveId) {
    return new Response("Missing archiveId parameter", { status: 400 });
  }

  // Pull environment variables
  const { VONAGE_APP_ID, VONAGE_PRIVATE_KEY64 } = process.env;
  const privateKey = Buffer.from(VONAGE_PRIVATE_KEY64, "base64");
  
  const credentials = {
    applicationId: VONAGE_APP_ID,
    privateKey,
  };

  const vonage = new Vonage(credentials);
  vonage.video = new Video(credentials);

  try {
    console.log('Attempting to view archive: ' + archiveId);
    const archive = await vonage.video.getArchive(archiveId);
    
    if (archive.status === 'available') {
      // 302 Redirect directly to the Vonage AWS MP4 URL
      return Response.redirect(archive.url, 302);
    } else {
      // Return a plain text message if the file is still compiling
      return new Response("Video is still processing. Please try again in a few moments.", { 
        status: 202,
        headers: { "Content-Type": "text/plain" }
      });
    }
    
  } catch (error) {
    console.error("Error viewing archive: ", error);
    return new Response("Error retrieving video: " + error.message, { 
      status: 500 
    });
  }
};