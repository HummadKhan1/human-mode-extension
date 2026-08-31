// Human Mode - background service worker
// Calls the Anthropic API to classify candidate elements, then runs a
// programmatic verification pass before any decision is trusted.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are the classifier inside a browser extension called "Human Mode" that removes AI-injected UI features from websites and restores a human-first interface.

You will be given a list of candidate DOM elements from a single webpage. Each has: tag, id, class, ariaLabel, title, role, and a short snippet of visible text.

Classify each candidate as one of:
- "remove": an AI feature (AI shopping/search assistant, AI chatbot, AI-generated summary or overview) that should be hidden to restore a human-first interface.
- "keep": legitimate content or functionality (search bars, product info, articles, navigation, human contact links) that must NOT be touched.
- "surface": a human-alternative option (e.g. "contact a human", "talk to support") that should be made more visible.

Rules:
- For every "remove" or "surface" decision, include an "evidence" field: an exact substring copied from that element's id, class, ariaLabel, title, or text field that justifies the decision. If you can't point to real evidence in the given fields, do not classify it as remove/surface.
- The evidence must be a genuine AI-related signal (e.g. references to AI, chat, assistant, copilot, chatbot, generated/summary content). A big tech company's name appearing in an id/class is NOT evidence of an AI feature by itself - e.g. "google-one-tap" is Google's standard sign-in/credential autofill feature and has nothing to do with AI, even though "google" appears in it. Do not infer "this is AI-related" just because a well-known company name is present.
- Only output entries for "remove" or "surface" decisions. Omit anything you'd classify as "keep" - do not include it in the array at all.
- Respond with ONLY a JSON array, no prose, no markdown fences. Example:
[{"index": 3, "action": "remove", "evidence": "rufus", "reason": "AI shopping assistant widget"}]`;

async function classifyCandidates(payload) {
  const stored = await chrome.storage.local.get(["apiKey", "model"]);
  const apiKey = stored.apiKey;
  const model = stored.model || DEFAULT_MODEL;

  if (!apiKey) {
    return { error: "Missing API key. Add one in the Human Mode popup." };
  }

  const userPrompt = `Page URL: ${payload.url}
Page title: ${payload.title}

Candidate elements (JSON array):
${JSON.stringify(payload.candidates, null, 2)}`;

  // Retry once on a parse failure. This has been observed intermittently -
  // the model occasionally adds stray text around the JSON array despite
  // explicit formatting instructions. A single retry is cheap and handles
  // the common case without masking a genuinely broken response.
  let rawResult = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    rawResult = await callAndParse(apiKey, model, userPrompt);
    if (!rawResult.error) break;
    console.log(`[Human Mode] Attempt ${attempt + 1} failed: ${rawResult.error}${attempt === 0 ? " - retrying..." : " - giving up."}`);
  }

  if (rawResult.error) {
    return rawResult;
  }

  const decisions = rawResult.decisions;

  // --- Programmatic verification pass ---
  // Every decision's "evidence" string must actually appear in that candidate's
  // own captured fields. This is cheap (no extra API call) and catches the
  // classifier hallucinating a removal that isn't grounded in real page content.
  //
  // This alone isn't enough, though: it confirms evidence is REAL, not that
  // it's SUFFICIENT. Found on Bing: the model correctly found "cdxShowConv"
  // (a real class fragment meaning "chat mode toggled on") inside the search
  // box's own wrapper div, and removed the whole wrapper - taking the real
  // search bar down with it. The wrapper's class list also clearly contained
  // "sbox"/"sb_expanded_wrapper" (Bing's own naming for "search box"), which
  // should have overridden that conclusion. Added a second, independent
  // guard: known core-functionality keywords in an element's own id/class
  // block a removal outright, regardless of what evidence the model cited.
  // Expanded after Etsy: the model flagged Google One Tap (a standard sign-in/
  // credential autofill feature, completely unrelated to AI) for removal,
  // citing "google-one-tap-modal-div" as evidence. That text is real and
  // grounded (verification alone let it through), but it has nothing to do
  // with AI - the model fabricated the "AI-driven" framing rather than citing
  // a genuine AI signal. Added sign-in/auth terms alongside the search-box
  // terms as known legitimate non-AI functionality.
  const PROTECTED_KEYWORDS = [
    "sbox", "searchbox", "search-box", "search_box", "nav-search",
    "one-tap", "onetap", "signin", "sign-in", "login", "log-in", "auth", "credential"
  ];

  const candidateByIndex = new Map(payload.candidates.map(c => [c.index, c]));
  const verified = [];
  let rejectedCount = 0;

  decisions.forEach(d => {
    const candidate = candidateByIndex.get(d.index);
    if (!candidate || !d.evidence || typeof d.evidence !== "string") {
      rejectedCount++;
      return;
    }

    const idClass = [candidate.id, candidate.class].join(" ").toLowerCase();
    if (d.action === "remove" && PROTECTED_KEYWORDS.some(k => idClass.includes(k))) {
      console.log(`[Human Mode] Blocked removal of candidate ${d.index} - id/class matched a protected keyword despite model evidence:`, candidate);
      rejectedCount++;
      return;
    }

    const haystack = [candidate.id, candidate.class, candidate.ariaLabel, candidate.title, candidate.text]
      .join(" ")
      .toLowerCase();
    const evidence = d.evidence.toLowerCase().trim();

    if (evidence.length > 0 && haystack.includes(evidence)) {
      verified.push(d);
    } else {
      rejectedCount++;
    }
  });

  return { decisions: verified, rejectedCount };
}

// Handles just the API call and raw JSON parsing. Returns { decisions: [...] }
// on success or { error: "..." } on failure. Does NOT do verification -
// that needs payload.candidates, which stays in classifyCandidates's scope.
async function callAndParse(apiKey, model, userPrompt) {
  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      })
    });
  } catch (e) {
    return { error: `Network error calling Anthropic API: ${e.message}` };
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    return { error: "Could not parse API response as JSON." };
  }

  if (data.error) {
    return { error: data.error.message || "Anthropic API returned an error." };
  }

  const textBlock = (data.content || []).find(b => b.type === "text");
  if (!textBlock) {
    return { error: "No text content in API response." };
  }

  let decisions;
  try {
    let clean = textBlock.text.replace(/```json|```/g, "").trim();
    // The model sometimes adds a stray sentence before/after the array even
    // when told not to. Extract just the [...] portion as a fallback.
    const arrayMatch = clean.match(/\[[\s\S]*\]/);
    if (arrayMatch) clean = arrayMatch[0];
    decisions = JSON.parse(clean);
  } catch (e) {
    console.log("[Human Mode] Raw model output that failed to parse:", textBlock.text);
    return { error: "Could not parse model output as JSON.", raw: textBlock.text };
  }

  if (!Array.isArray(decisions)) {
    return { error: "Model output was not a JSON array." };
  }

  return { decisions };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "classify") {
    classifyCandidates(message.payload).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
});