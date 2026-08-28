// ==========================================
// DOM Elements & State
// ==========================================
const authBtn = document.getElementById('auth-btn');
const unauthView = document.getElementById('unauth-view');
const dashboardView = document.getElementById('dashboard-view');
const errorMessage = document.getElementById('error-message');
const statsContainer = document.getElementById('stats-container');

// QR Code Elements
const qrContainer = document.getElementById('qrcode');
const feedbackLink = document.getElementById('feedback-link');
const downloadQrBtn = document.getElementById('download-qr-btn');

const appHeader = document.getElementById('app-header');

let currentUser = null;

// Detect if running in Codespaces or localhost
const isLocalDev = window.location.hostname.includes('localhost') || window.location.hostname.includes('.github.dev');

// ==========================================
// Netlify Identity Event Listeners
// ==========================================
netlifyIdentity.on('init', (user) => {
    // Only auto-login real users to prevent locking devs into fake state on load
    if (!isLocalDev) {
        handleAuthChange(user);
    }
});

netlifyIdentity.on('login', async (user) => {
    try {
        // 1. Fetch the authorized email from the backend
        const configRes = await fetch('/api/get-config');
        const { adminEmail } = await configRes.json();

        // 2. Check the logged-in user against the environment variable
        if (user.email === adminEmail) {
            netlifyIdentity.close();
            handleAuthChange(user);
        } else {
            console.warn("Unauthorized access attempt by:", user.email);
            netlifyIdentity.logout();
            alert("Sorry, you are not authorized to view the instructor dashboard.");
        }
    } catch (error) {
        console.error("Error verifying authorization:", error);
        netlifyIdentity.logout();
        alert("Error verifying credentials. Please try again.");
    }
});

netlifyIdentity.on('logout', () => {
    handleAuthChange(null);
});

// ==========================================
// Auth Button Logic with Dev Mode Bypass
// ==========================================
authBtn.addEventListener('click', () => {
    if (currentUser) {
        if (isLocalDev) {
            handleAuthChange(null); // Mock logout
        } else {
            netlifyIdentity.logout(); // Real logout
        }
        return;
    }

    // --- THE DEV MODE BYPASS ---
    if (isLocalDev) {
        console.log("Running locally: Bypassing real OAuth for testing.");
        // Create a mock user object that matches Netlify Identity's structure
        const mockUser = {
            jwt: async () => 'DEV_MOCK_TOKEN',
            user_metadata: { full_name: 'Local Tester' }
        };
        handleAuthChange(mockUser);
        return;
    }

    // Production: Open the real Netlify Identity widget
    netlifyIdentity.open();
});

// ==========================================
// State Management & API Calls
// ==========================================
async function handleAuthChange(user) {
    currentUser = user;

    if (user) {
        authBtn.textContent = 'Log Out';
        errorMessage.style.display = 'none';

        appHeader.className = 'header-logged-in';
        statsContainer.style.display = 'flex';

        await fetchDashboardData();
    } else {
        authBtn.textContent = 'Log In with GitHub';

        appHeader.className = 'header-logged-out';
        statsContainer.style.display = 'none'; // Hide stats banner
        statsContainer.innerHTML = '';

        unauthView.style.display = 'flex';
        dashboardView.style.display = 'none';
        statsContainer.innerHTML = '';
    }
}

async function fetchDashboardData() {
    if (!currentUser) return;

    try {
        const token = await currentUser.jwt(true);

        const response = await fetch('/api/get-sessions', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error("Access Denied: You are not the authorized instructor for this repo.");
            }
            throw new Error("Failed to fetch dashboard data.");
        }

        const data = await response.json();
        renderDashboard(data);

    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

// We will store this in memory so our sub-views can access it instantly
let groupedSessionData = {}; // holds feedback grouped by sessionId
let sessionMetadata = {}; // holds metadata like AI summaries and counts for each session
let sessionDetails = {}; // holds session titles and other details for each session

// ==========================================
// Main Dashboard Initialization
// ==========================================
function renderDashboard(data) {
    unauthView.style.display = 'none';
    dashboardView.style.display = 'block';

    // Group the flat feedback array by sessionId
    groupedSessionData = data.feedback.reduce((acc, item) => {
        if (!acc[item.sessionId]) acc[item.sessionId] = [];
        acc[item.sessionId].push(item);
        return acc;
    }, {});

    sessionMetadata = data.sessionMeta || {};

    sessionDetails = data.sessionDetails || {};

    renderGlobalStats();

    // Draw the initial list of session cards
    renderSessionCards();
}

// ==========================================
// Render the List of Sessions
// ==========================================
function renderSessionCards() {
    const feedbackList = document.getElementById('feedback-list');
    feedbackList.innerHTML = '<h3 style="margin-top: 30px; margin-bottom: 20px;">Sessions</h3>';

    const createdSessionIds = Object.keys(sessionDetails);
    const legacySessionIds = Object.keys(groupedSessionData);
    const sessionIds = [...new Set([...createdSessionIds, ...legacySessionIds])];

    if (sessionIds.length === 0) {
        feedbackList.innerHTML += '<p>No sessions found.</p>';
        return;
    }

    sessionIds.forEach(sessionId => {
        const responses = groupedSessionData[sessionId] || [];

        // Calculate the average rating specifically for this session
        const ratedResponses = responses.filter(r => Number(r.rating) > 0);
        const avg = ratedResponses.length
            ? (ratedResponses.reduce((sum, r) => sum + Number(r.rating), 0) / ratedResponses.length).toFixed(1)
            : 'N/A';

        const textComments = responses.filter(r => r.textFeedback && r.textFeedback.trim() !== '');
        const currentFeedbackCount = textComments.length;

        const savedMeta = sessionMetadata[sessionId] ? sessionMetadata[sessionId] : null;
        const hasSummary = !!(savedMeta && savedMeta.aiSummary);

        const sessionTitle = sessionDetails[sessionId]?.title || sessionId;

        const newResponsesCount = currentFeedbackCount - (savedMeta ? savedMeta.summarizedCount : 0);

        // It needs an update if responses were added, removed, OR flagged as outdated
        const needsUpdate = hasSummary && (newResponsesCount !== 0 || savedMeta.isOutdated);

        // Conditionally build the badge HTML
        let badgeHtml = '';
        if (needsUpdate) {
            if (savedMeta.isOutdated || newResponsesCount < 0) {
                // If data was deleted, show a red "Data Changed" badge
                badgeHtml = `<span style="font-size: 0.75rem; background: #f8d7da; color: #721c24; padding: 2px 6px; border-radius: 10px;">Data Changed</span>`;
            } else if (newResponsesCount > 0) {
                // If data was added, show the yellow "X New Responses" badge
                badgeHtml = `<span style="font-size: 0.75rem; background: #ffeeba; color: #856404; padding: 2px 6px; border-radius: 10px;">${newResponsesCount} New Responses</span>`;
            }
        }

        const card = document.createElement('div');

        card.style.cssText = `
      border: 1px solid #ddd; 
      border-radius: 8px; 
      padding: 20px; 
      margin-bottom: 15px; 
      background: var(--bg-color);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    `;

        // Add a subtle hover effect via JS since we are injecting inline styles
        card.onmouseenter = () => card.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
        card.onmouseleave = () => card.style.boxShadow = "none";


        let aiHtml = '';
        if (currentFeedbackCount > 0) {
            if (!hasSummary) {
                // State 1: Never generated
                aiHtml = `
                    <button class="ai-btn" style="background: linear-gradient(135deg, #6e8efb, #a777e3); color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                      ✨ Generate AI Summary
                    </button>
                    <p class="ai-result" style="display: none; margin-top: 10px; font-size: 0.9rem; font-style: italic; color: #444; background: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 3px solid #a777e3;"></p>
                `;
            } else {
                // State 2 & 3: Show existing summary, optionally add the Update button
                aiHtml = `
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 3px solid #a777e3; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                            <strong style="font-size: 0.85rem; color: #a777e3;">✨ AI Summary</strong>
                            ${badgeHtml}
                        </div>
                        <p class="ai-result" style="margin: 0; font-size: 0.9rem; font-style: italic; color: #444;">
                            ${savedMeta.aiSummary}
                        </p>
                    </div>
                    ${needsUpdate ? `
                        <button class="ai-btn" style="background: #eee; color: #333; border: 1px solid #ccc; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                          🔄 Update Summary
                        </button>
                    ` : ''}
                `;
            }
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="cursor: pointer; flex-grow: 1;" class="card-header">
                <!-- Render the real Title here -->
                <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-color);">📍 ${sessionTitle}</h4>
                <div style="font-size: 0.9rem; margin-top: 8px;">
                    <strong>${responses.length}</strong> Responses &nbsp;|&nbsp; <strong>${avg}</strong> Avg Rating
                </div>
                </div>
                
                <!-- The QR Code Trigger Button -->
                <button class="show-qr-btn secondary-btn" style="background: none; border: 1px solid #ccc; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                🔗 QR Link
                </button>
            </div>
          
          ${currentFeedbackCount > 0 ? `
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #eee;">
            ${aiHtml}
          </div>
          ` : ''}
        `;

        // When clicked, trigger the detail view
        if (ratedResponses.length > 0) {
            card.onclick = () => renderSessionDetail(sessionId, sessionTitle);
        }

        card.querySelector('.show-qr-btn').onclick = (e) => {
            e.stopPropagation(); // Stop bubbling so the card doesn't open
            showQrDialog(sessionId, sessionTitle);
        };

        const aiBtn = card.querySelector('.ai-btn');
        if (aiBtn) {
            aiBtn.onclick = async (e) => {
                e.stopPropagation();
                const resultBox = card.querySelector('.ai-result');

                aiBtn.textContent = '✨ Processing...';
                aiBtn.disabled = true;

                try {
                    const token = await currentUser.jwt(true);
                    const res = await fetch('/api/generate-summary', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ sessionName: sessionId, comments: textComments.map(c => c.textFeedback) })
                    });

                    if (!res.ok) {
                        const errorData = await res.json();
                        throw new Error(errorData.error || 'Failed to generate summary');
                    }

                    const data = await res.json();

                    sessionMetadata[sessionId] = {
                        aiSummary: data.summary,
                        summarizedCount: textComments.length, // You just summarized all currently known comments
                        isOutdated: false // Reset the outdated flag since we just generated a new summary
                    };

                    renderSessionCards();

                } catch (err) {
                    console.error(err);
                    aiBtn.textContent = `(${err}) Failed. Try Again`;
                    aiBtn.disabled = false;
                }
            };
        }

        feedbackList.appendChild(card);
    });
}

// ==========================================
// Render the Detail View for a Session
// ==========================================
function renderSessionDetail(sessionId, sessionTitle) {
    const feedbackList = document.getElementById('feedback-list');
    const responses = groupedSessionData[sessionId];

    // Sort responses newest first
    responses.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Build the Header with a Back Button
    feedbackList.innerHTML = `
    <div style="margin-top: 30px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px;">
      <button id="backBtn" class="secondary-btn" style="background: none; border: 1px solid #ddd; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
        ← Back
      </button>
      <h3 style="margin: 0;">Session: ${sessionTitle}</h3>
      <button class="show-qr-btn secondary-btn" style="background: none; border: 1px solid #ccc; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
            🔗 QR Link
        </button>
    </div>
  `;

    // Attach event listener to the back button to redraw the main cards
    document.getElementById('backBtn').onclick = () => renderSessionCards();

    feedbackList.querySelector('.show-qr-btn').onclick = (e) => {
        e.stopPropagation(); // Stop bubbling so the card doesn't open
        showQrDialog(sessionId, sessionTitle);
    };

    // Draw the individual feedback cards
    responses.forEach(item => {
        const date = new Date(item.submittedAt).toLocaleDateString();
        const stars = item.rating ? '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating) : 'No rating';

        const videoHtml = item.archiveId
            ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ddd;">
           📹 <strong>Video Attached:</strong> 
           <a href="/api/get-recording?archiveId=${item.archiveId}" target="_blank" style="color: #007bff; text-decoration: none; font-weight: 500;">
             Watch Recording →
           </a>
         </div>`
            : '';

        const feedbackCard = document.createElement('div');
        feedbackCard.style.cssText = 'border: 1px solid #eee; border-radius: 8px; padding: 20px; margin-bottom: 15px; background: var(--bg-color); box-shadow: 0 2px 4px rgba(0,0,0,0.02); position: relative;';

        feedbackCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div>
            <strong style="font-size: 1.1rem;">${item.name}</strong> 
            ${item.socialHandle ? `<span style=" font-weight: normal; margin-left: 5px;">(${item.socialPlatform} : ${item.socialHandle})</span>` : ''}
            </div>
            <span style="font-size: 0.85rem; padding: 3px 8px; border-radius: 12px;">${date}</span>
        </div>
        <div style="color: var(--star-active); font-size: 1.2rem; margin-bottom: 15px;">${stars}</div>
        <button class="delete-feedback-btn" aria-label="Delete Feedback">🗑️</button>
        ${item.textFeedback ? `<p style="margin: 0; line-height: 1.5;">"${item.textFeedback}"</p>` : ''}
        ${videoHtml}
        `;

        const deleteFeedbackBtn = feedbackCard.querySelector('.delete-feedback-btn');
        if (deleteFeedbackBtn) {
            deleteFeedbackBtn.onclick = async (e) => {
                e.stopPropagation();
                deleteFeedbackItem(item.id, sessionId);
            };
        }


        feedbackList.appendChild(feedbackCard);
    });
}

function showError(message) {
    unauthView.style.display = 'block';
    dashboardView.style.display = 'none';
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';

    if (!isLocalDev) {
        netlifyIdentity.logout();
    }
}

// ==========================================
// QR Code Generation & Download
// ==========================================

downloadQrBtn.addEventListener('click', () => {
    const sessionTitle = document.querySelector('#qr-session-title').innerText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace spaces/special chars with hyphens
        .replace(/(^-|-$)+/g, '');;
    const sessionId = sessionTitle.trim() || 'session';
    // The qrcode library generates either an img or canvas tag inside the container
    const img = qrContainer.querySelector('img') || qrContainer.querySelector('canvas');

    if (!img) return;

    const imageUri = img.src || img.toDataURL("image/png");

    const link = document.createElement('a');
    link.href = imageUri;
    link.download = `qr-code-${sessionId}.png`;
    link.click();
});

// --- AUTO-SLUG LOGIC ---
const titleInput = document.getElementById('session-title-input');
const sessionIdInput = document.getElementById('session-id-input');

titleInput.addEventListener('input', (e) => {
    // Converts "Hello World @ 2026!" to "hello-world-2026"
    sessionIdInput.value = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace spaces/special chars with hyphens
        .replace(/(^-|-$)+/g, '');   // Trim hyphens from start or end
});

// --- CREATE SESSION LOGIC ---
document.getElementById('create-session-btn').addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const sessionId = sessionIdInput.value.trim();

    if (!title || !sessionId) return alert("Please fill out both fields.");

    try {
        const token = await currentUser.jwt(true);
        const res = await fetch('/api/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, sessionId })
        });

        if (!res.ok) throw new Error("Failed to create session");

        // Close creation dialog, fetch fresh data, and instantly show QR
        document.getElementById('createSessionDialog').close();
        await fetchDashboardData();
        showQrDialog(sessionId, title);

    } catch (err) {
        alert(err.message);
    }
});

// --- DYNAMIC QR MODAL FUNCTION ---
function showQrDialog(sessionId, title = sessionId) {
    const qrDialog = document.getElementById('qrDialog');
    const qrContainer = document.getElementById('qrcode');
    const feedbackLink = document.getElementById('feedback-link');

    document.getElementById('qr-session-title').textContent = title;

    const url = `${window.location.origin}/?session=${encodeURIComponent(sessionId)}`;
    feedbackLink.href = url;
    feedbackLink.textContent = url;

    qrContainer.innerHTML = ""; // Clear old QR
    new QRCode(qrContainer, {
        text: url,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    qrDialog.showModal();
}

async function deleteFeedbackItem(feedbackId, sessionId) {
    // 1. Prevent accidental clicks
    if (!confirm("Are you sure you want to delete this feedback? This cannot be undone.")) {
        return;
    }

    try {
        const token = await currentUser.jwt(true);

        // 2. Call the new endpoint
        const res = await fetch('/api/delete-feedback', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id: feedbackId })
        });

        if (!res.ok) throw new Error("Failed to delete from server");

        const deletedItem = (groupedSessionData[sessionId] || []).find(item => item.id === feedbackId);
        const hadText = deletedItem && deletedItem.textFeedback && deletedItem.textFeedback.trim() !== '';

        // 3. Update the local state variable
        // Filter out the deleted item from the global object
        groupedSessionData[sessionId] = groupedSessionData[sessionId].filter(item => item.id !== feedbackId);

        if (hadText && sessionMetadata[sessionId]) {
            sessionMetadata[sessionId].isOutdated = true;
        }

        // 4. Re-render the UI
        // If the session now has 0 feedback items, we might want to close the detail view
        if (groupedSessionData[sessionId].length === 0) {
            // document.getElementById('session-detail-view').style.display = 'none';
            renderSessionCards();
        } else {
            // Otherwise, refresh the detail view to remove the deleted card
            renderSessionDetail(sessionId, sessionDetails[sessionId]?.title || sessionId);
        }

        renderGlobalStats();

    } catch (error) {
        console.error("Deletion failed:", error);
        alert("An error occurred while deleting the feedback.");
    }
}

function renderGlobalStats() {
    let totalFeedback = 0;
    let sumRatings = 0;
    let ratingCount = 0;

    // Loop through every session's array of feedback
    Object.values(groupedSessionData).forEach(sessionResponses => {
        totalFeedback += sessionResponses.length;

        sessionResponses.forEach(r => {
            const rating = Number(r.rating);
            if (rating > 0) { // Only count actual star ratings
                sumRatings += rating;
                ratingCount++;
            }
        });
    });

    const globalAverage = ratingCount > 0 ? (sumRatings / ratingCount).toFixed(1) : "0.0";

    // Overwrite the stats container with the fresh math
    statsContainer.innerHTML = `
        <div class="stat-card">
          <h3>Global Average:</h3>
          <p>&nbsp;&nbsp;${globalAverage} / 5</p>
        </div>
        <div class="stat-card">
          <h3>Total Feedback:</h3>
          <p>&nbsp;&nbsp;${totalFeedback}</p>
        </div>
    `;
}