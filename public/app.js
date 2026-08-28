// Get the session ID from the URL (e.g., ?session=atlanta-stop)
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

let vonageSession;
let publisher;
let isRecording = false;
let countdownInterval;

// Elements
const enableCameraBtn = document.getElementById('enable-camera-btn');
const recordBtn = document.getElementById('record-btn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const timerDisplay = document.getElementById('timer-display');
const form = document.getElementById('feedback-form');

async function loadConfig() {
    try {
        const res = await fetch('/api/get-config');
        const { adminEmail } = await res.json();

        // Update the mailto link dynamically
        const emailLink = document.getElementById('consentEmailLink');
        if (emailLink) {
            emailLink.href = `mailto:${adminEmail}`;
        }
    } catch (error) {
        console.error("Could not load config for consent link:", error);
    }
}

loadConfig();

function initCamera() {
    return new Promise((resolve, reject) => {
        publisher = OT.initPublisher('publisher-container', {
            insertMode: 'append',
            width: '100%',
            height: '100%'
        }, (err) => {
            if (err) {
                console.error("Camera access denied or failed", err);
                reject(err);
            } else {
                resolve(); // Camera successfully initialized
            }
        });
    });
}

async function stopRecordingVideo(archiveId) {
    // Instantly stop the timer so the user knows their action registered
    clearInterval(countdownInterval);
    timerDisplay.style.display = "none";

    // Instantly update the Stop button to a loading state
    stopRecordBtn.disabled = true;
    stopRecordBtn.textContent = "Stopping...";

    // Instantly stop the camera feed
    if (vonageSession) {
        vonageSession.unpublish(publisher);
        vonageSession.disconnect();
    }

    // Ping the Netlify function to stop the archive on Vonage's end
    try {
        await fetch('/api/stop-recording', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archiveId: archiveId })
        });
    } catch (error) {
        console.error("Error stopping archive:", error);
    } finally {
        // AFTER the server responds (success or fail), show the final UI
        stopRecordBtn.style.display = "none";
        recordBtn.style.display = "inline-block";
        recordBtn.disabled = true;
        recordBtn.textContent = "Recording Finished";
    }
}

// Handle the Recording logic
recordBtn.addEventListener('click', async () => {
    if (isRecording) return;

    isRecording = true;
    recordBtn.disabled = true;
    recordBtn.textContent = "Connecting...";

    try {
        // Get the credentials, now including applicationId
        const credsRes = await fetch('/api/get-credentials', { method: 'POST' });
        const { applicationId, vonageSessionId, token } = await credsRes.json();

        // Connect to the session using the modern applicationId parameter
        vonageSession = OT.initSession(applicationId, vonageSessionId);

        vonageSession.connect(token, (err) => {
            if (err) throw err;

            // Publish the camera to the room
            vonageSession.publish(publisher, async (pubErr) => {
                if (pubErr) throw pubErr;

                recordBtn.textContent = "Starting Recording...";

                // 4. Start the archive
                const archiveRes = await fetch('/api/start-recording', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vonageSessionId: vonageSessionId,
                        workshopSessionId: sessionId
                    })
                });

                const { archiveId } = await archiveRes.json();

                let hiddenInput = document.createElement("input");
                hiddenInput.type = "hidden";
                hiddenInput.name = "archiveId";
                hiddenInput.value = archiveId;
                form.appendChild(hiddenInput);

                recordBtn.style.display = "none"; // Hide the start button
                stopRecordBtn.style.display = "inline-block"; // Show the stop button
                timerDisplay.style.display = "block";

                stopRecordBtn.onclick = () => stopRecordingVideo(archiveId);

                // Start the 20-second countdown
                let timeLeft = 20;
                timerDisplay.textContent = `00:${timeLeft}`;

                countdownInterval = setInterval(() => {
                    timeLeft -= 1;

                    // Format the timer display
                    timerDisplay.textContent = `00:${timeLeft < 10 ? '0' : ''}${timeLeft}`;

                    if (timeLeft <= 0) {
                        // Trigger the same stop function if they hit 20 seconds
                        stopRecordingVideo(archiveId);
                    }
                }, 1000);
            });
        });

    } catch (error) {
        console.error("Recording failed to start", error);
        recordBtn.disabled = false;
        recordBtn.textContent = "Try Again";
        isRecording = false;
    }
});
// Enforce the 20-second cap
function startTimer() {
    let timeLeft = 20;

    const timer = setInterval(async () => {
        timeLeft--;
        timerDisplay.textContent = `${timeLeft}s remaining`;

        if (timeLeft <= 0) {
            clearInterval(timer);

            // Unpublish stream and tell backend to stop archiving
            if (vonageSession) vonageSession.unpublish(publisher);

            recordBtn.textContent = "Recording Complete";
            timerDisplay.style.display = "none";

            // Tell Netlify function to stop the archive
            await fetch(`/api/stop-recording`, {
                method: 'POST',
                body: JSON.stringify({ archiveId: form.archiveId.value })
            });
        }
    }, 1000);
}

// Handle Form Submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.sessionId = sessionId;

    try {
        const res = await fetch('/api/submit-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {

            if (publisher) {
                publisher.destroy(); // Stop the camera feed after submission
            }
            document.querySelector('.feedback-container').innerHTML = `
        <div id="confirmation" class="confirmation">
      <div class="confirmation-icon">
        <svg viewBox="0 0 52 52" width="40" height="40" aria-hidden="true">
          <circle cx="26" cy="26" r="25" fill="none" />
          <path fill="none" d="M14 27l8 8 16-18" />
        </svg>
      </div>
      <h2>Thank you!</h2>
      <p>Your feedback has been received. We appreciate you taking the time to share it.</p>
    </div>
      `;
        }
    } catch (error) {
        console.error("Submission failed", error);
    }
});

// ==========================================
// Toggle Submit Button via Consent Checkbox
// ==========================================
const consentCheckbox = document.getElementById('consent');
const submitBtn = document.getElementById('submit-btn');

if (consentCheckbox && submitBtn) {
    consentCheckbox.addEventListener('change', (e) => {
        // If checked, remove the disabled attribute. If unchecked, add it back.
        submitBtn.disabled = !e.target.checked;
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');

    // Target the container holding your form (adjust ID to match your HTML)
    const feedbackContainer = document.querySelector('.feedback-container');

    // Helper function to wipe the form and show the error state
    const blockFeedback = () => {
        if (feedbackContainer) {
            feedbackContainer.innerHTML = `
                <div id="no-session" style="text-align: center; padding: 40px 20px;">
                    <h2>No session selected.</h2>
                    <p>Please scan the QR code provided by the instructor or check your URL.</p>
                </div>
            `;
        }
    };

    // Immediately block if there is no session in the URL
    if (!sessionId) {
        blockFeedback();
        return;
    }

    try {
        // Check if the session actually exists in the database
        const response = await fetch(`/api/get-session?sessionId=${encodeURIComponent(sessionId)}`);

        if (response.ok) {
            const data = await response.json();

            // Success! Update the UI with the custom Session Title
            if (data.title) {
                const titleDisplay = document.getElementById('session-title-display');
                if (titleDisplay) {
                    titleDisplay.textContent = `${data.title} Feedback`;
                    titleDisplay.style.color = "var(--accent, #6e8efb)";
                }
            }
        } else {
            // Triggered if the API returns a 404 (Session Not Found) or 500 error
            blockFeedback();
        }
    } catch (error) {
        // Triggered if the network fails completely
        console.error("Failed to validate session:", error);
        blockFeedback();
    }
});


// Handle Camera Initialization
if (enableCameraBtn) {
    enableCameraBtn.addEventListener('click', async () => {
        try {
            // Update UI while waiting for user to click "Allow"
            enableCameraBtn.textContent = '⌛ Waiting for permission...';
            enableCameraBtn.disabled = true;

            // Wait for Vonage to successfully access the camera and microphone
            await initCamera();

            // Swap the buttons: Hide Enable Camera, Show Start Recording
            enableCameraBtn.style.display = 'none';
            recordBtn.style.display = 'inline-block';

        } catch (error) {
            // Reset if they deny permissions
            enableCameraBtn.textContent = '❌ Camera Access Denied';
            enableCameraBtn.disabled = false; // Let them try again
        }
    });
}