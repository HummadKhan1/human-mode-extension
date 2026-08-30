// Human Mode - Agent
//
// Pipeline:
// 1. Extract candidate elements using broad heuristics (recall-focused: iframes,
//    fixed/sticky-positioned elements, headings, elements whose id/class/aria-label/
//    text loosely matches AI-related keywords). This is deliberately generous -
//    false positives here are cheap, since the classifier filters them next.
// 2. Send candidates to the background service worker, which asks Claude to
//    classify each one as remove / keep / surface, with required text evidence.
// 3. Background does a programmatic verification pass: every "remove"/"surface"
//    decision must have evidence text that actually appears in that element's
//    captured attributes. Decisions that fail this check are discarded before
//    ever reaching the page - this is what catches a hallucinated removal.
// 4. Apply only the verified decisions to the live DOM.

const AI_KEYWORDS = [
  "chat", "assistant", "copilot", "chatbot", "virtual assistant",
  "ai overview", "ai summary", "ai-generated", "rufus", "ask ai",
  "overview", "bot widget", "messaging window"
];

let globalCandidateCounter = 0; // persists across multiple scans so IDs never collide

function getCandidates() {
  const all = document.querySelectorAll("body *");
  const MAX_CANDIDATES = 80; // balance between coverage and prompt size/cost

  // Two priority tiers instead of one flat cap. Real pages often load many
  // unrelated iframes (ads, analytics, tracking pixels) before the actual
  // AI widget appears in the DOM. Capturing in raw document order let junk
  // iframes fill the candidate budget before we ever reached the one that
  // mattered - this happened on Zendesk, where the real chat launcher iframe
  // was the last of ~11 iframes on the page, the rest were ad/tracking iframes.
  // Fix: collect keyword-matched elements first (highest-confidence signal),
  // then fill any remaining budget with generic iframe/fixed/heading elements.
  const priority = [];
  const fallback = [];

  for (const el of all) {
    if (el.hasAttribute("data-human-mode-id")) continue;

    const tag = el.tagName.toLowerCase();
    const id = el.id || "";
    const cls = (typeof el.className === "string") ? el.className : "";
    const ariaLabel = el.getAttribute("aria-label") || "";
    const title = el.getAttribute("title") || "";
    const role = el.getAttribute("role") || "";
    const ariaLevel = el.getAttribute("aria-level") || "";
    const text = (el.textContent || "").trim().slice(0, 150);

    const isIframe = tag === "iframe";
    const isHeading2 = role === "heading" && ariaLevel === "2";

    let isFixed = false;
    try {
      const pos = window.getComputedStyle(el).position;
      isFixed = pos === "fixed" || pos === "sticky";
    } catch (e) {
      // ignore elements we can't compute style for
    }

    let iframeTitle = "";
    if (isIframe) {
      try {
        iframeTitle = el.contentDocument?.title || "";
      } catch (e) {
        // cross-origin iframe, can't read title from JS - use the iframe's own title attr instead
        iframeTitle = title;
      }
    }

    const haystack = [id, cls, ariaLabel, title, text, iframeTitle].join(" ").toLowerCase();
    const matchesKeyword = AI_KEYWORDS.some(k => haystack.includes(k));

    const record = {
      tag, id, class: cls.slice(0, 150), ariaLabel, title, role,
      text: (iframeTitle || text).slice(0, 150),
      _el: el
    };

    if (matchesKeyword) {
      priority.push(record);
    } else if (isIframe || isFixed || isHeading2) {
      fallback.push(record);
    }
  }

  const selected = priority.concat(fallback).slice(0, MAX_CANDIDATES);
  return selected.map((record) => {
    const index = globalCandidateCounter++;
    record._el.setAttribute("data-human-mode-id", String(index));
    const { _el, ...rest } = record;
    return { index, ...rest };
  });
}

function applyDecisions(decisions) {
  let removedCount = 0;
  let surfacedCount = 0;

  decisions.forEach(d => {
    const el = document.querySelector(`[data-human-mode-id="${d.index}"]`);
    if (!el) return;

    if (d.action === "remove") {
      el.style.setProperty("display", "none", "important");
      el.setAttribute("data-human-mode-removed", "agent");
      el.setAttribute("data-human-mode-reason", d.reason || "");
      removedCount++;
    } else if (d.action === "surface") {
      el.style.setProperty("outline", "3px solid #2563eb", "important");
      el.style.setProperty("outline-offset", "2px", "important");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      surfacedCount++;
    }
  });

  return { removedCount, surfacedCount };
}

(function main() {
  chrome.storage.local.get(["humanModeEnabled"], (data) => {
    if (data.humanModeEnabled === false) return; // default: on
    runScan();
  });

  function runScan() {
    const candidates = getCandidates();
    if (candidates.length === 0) {
      console.log("[Human Mode] No candidate elements found on this page.");
      return;
    }

    const payload = {
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
      candidates
    };

    chrome.runtime.sendMessage({ type: "classify", payload }, (response) => {
      if (!response) {
        console.log("[Human Mode] No response from background worker.");
        return;
      }
      if (response.error) {
        console.log("[Human Mode] Classification error:", response.error);
        chrome.storage.local.set({
          [`lastResult_${window.location.hostname}`]: {
            error: response.error, timestamp: Date.now()
          }
        });
        return;
      }

      const { removedCount, surfacedCount } = applyDecisions(response.decisions || []);
      console.log(`[Human Mode] Removed ${removedCount}, surfaced ${surfacedCount}, rejected ${response.rejectedCount || 0} unverified decision(s).`);

      const key = `lastResult_${window.location.hostname}`;
      chrome.storage.local.set({
        [key]: {
          removedCount,
          surfacedCount,
          rejectedCount: response.rejectedCount || 0,
          candidateCount: candidates.length,
          timestamp: Date.now()
        }
      });
    });
  }
})();