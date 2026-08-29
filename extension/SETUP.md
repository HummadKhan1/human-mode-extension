# Quick Start

## Load either extension in Chrome

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `baseline/` folder (or `extension/` for the agent version)
5. It's now active on every page you visit

You can load both at once — they're independent extensions, so you can compare them side by side. Disable one via its toggle on `chrome://extensions` when you want to isolate the other's behavior.

## Set up the agent version

1. Click the Human Mode icon in your toolbar
2. Paste in your Anthropic API key (get one at console.anthropic.com → API Keys)
3. Choose a model (Haiku is faster/cheaper, good default for testing)
4. Click **Save settings**
5. Reload any page you want to test on

## What to expect

- **Baseline**: only does anything on Amazon, Google Search, Bing, and Zendesk (the 4 sites it has hardcoded selectors for). Everywhere else, it's silent — open the browser console (F12 → Console tab) to see `[Human Mode - Baseline] No hardcoded rules for "..."` confirming it did nothing.
- **Agent**: makes one API call per page load to classify candidate elements. Open the console to see `[Human Mode] Removed X, surfaced Y, rejected Z unverified decision(s)`. The popup also shows this after a reload.

## Known limitations (be upfront about these in your submission)

- The API key is stored in `chrome.storage.local` and sent directly to `api.anthropic.com` from the browser. This is fine for a hackathon demo with your own key, but is not how you'd ship this to end users in production (you'd want a backend proxy).
- The candidate-extraction heuristic caps at 60 elements per page to keep prompts small — extremely dense pages may miss something outside that cap.
- Cross-origin iframes (like some chat widgets) block reading their internal title via JavaScript; the code falls back to the iframe's own `title` attribute, which isn't always present.
