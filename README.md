# Feedback App
an application for speakers and workshop instructors to get feedback from attendees

## 🚀 Getting Started

The easiest way to run this application is by using GitHub Codespaces. This sets up the entire environment automatically in your browser.

1. **Fork this repository** to your own GitHub account.
2. In your new fork, click the green **<> Code** button at the top right of the files list.
3. Select the **Codespaces** tab.
4. Click **Create codespace on main**.

Once the environment loads, the setup script will run automatically to configure your Vonage and Netlify credentials!

When ready, the Codespaces terminal will ask for your **primary** GitHub [email address](https://github.com/settings/emails), this will be used when logging into the application's dashboard.

The setup script will also create the Vonage Application needed for the Video testimonials. It will ask for API Key and API Secret which can be found in the [Vonage Dashboard](https://dashboard.vonage.com)

Once you have tried out and are happy with the application, it's time to deploy to Netlify.

In a new Codespaces terminal window, enter these commands:

> Note: for the intermediate steps, selecting the default (press Enter) is just fine.

netlify login

netlify init --manual

netlify env:import .env

netlify deploy --build --prod

### Final Step: Enable GitHub Login for your Dashboard

To log into your speaker dashboard, you just need to turn on GitHub as a login provider in your Netlify settings.

**1. Go to your Netlify Dashboard**
Open your newly deployed site's settings in the [Netlify dashboard](https://app.netlify.com/).

**2. Enable GitHub**
* Go to **Project configuration > Identity**.
* Scroll down to **External providers** and click **Add provider**.
* Select **GitHub**, leave "Use default configuration" checked, and click **Save**.

That's it! You can now log into your Feedback App's dashboard (https://YOUR-NETLIFY-PROJECT.netlify.app/dashboard) using your GitHub account.

> Note: If you see a notification in the bottom right of your Feedback App about it being Private, click make it Public so that people will be able to use your application to leave feedback.

## ⚙️ Technologies used

Vonage Video API [[documentation](https://developer.vonage.com/en/video/overview)]

Netlify AI Gateway [[documentation](https://docs.netlify.com/build/ai-gateway/overview/)]

Netlify Blobs [[documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)]

Netlify Functions [[documentation](https://docs.netlify.com/build/functions/overview/)]

Netlify Identity [[documentation](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/)]

Netlify Deploy [[documentation](https://docs.netlify.com/deploy/deploy-overview/)]
