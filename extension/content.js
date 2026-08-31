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

// Plain document.querySelectorAll("body *") cannot see inside shadow DOM
// boundaries - many modern sites build interactive widgets (chat bubbles,
// assistants) as web components that render their real content inside a
// shadow root. Found on Walmart: Sparky's button had a clear, matchable
// aria-label ("Open sparky, your AI shopping assistant") but the whole page
// only yielded 5 total candidates, suggesting most of the interactive UI
// was invisible to a normal DOM query. This walks into any OPEN shadow
// roots recursively. Closed shadow roots remain a genuine, unavoidable
// blind spot - there is no JS API to access them from outside.
function getAllElementsIncludingShadowDOM(root) {
  const results = [];
  function walk(node) {
    if (!node || !node.querySelectorAll) return;
    const children = node.querySelectorAll("*");
    children.forEach(el => {
      results.push(el);
      if (el.shadowRoot) {
        walk(el.shadowRoot);
      }
    });
  }
  walk(root);
  return results;
}

let globalCandidateCounter = 0; // persists across multiple scans so IDs never collide

function getCandidates() {
  const all = getAllElementsIncludingShadowDOM(document.body);
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
    const matchesKeywordPhrase = AI_KEYWORDS.some(k => haystack.includes(k));
    // Found on Yahoo: an element's aria-label said "Yahoo AI Information
    // Description" - a completely genuine AI signal, but it matched none of
    // our specific phrases (ai summary/ai overview/etc.), so it was never
    // even extracted as a candidate. Substring-matching bare "ai" would
    // create false positives on unrelated words (detail, email, said,
    // contain), so instead match "AI" as a standalone WORD - surrounded by
    // non-letter characters on both sides. This catches genuine uses
    // ("Yahoo AI", "using AI to") without matching words that merely
    // contain the letters "ai".
    const matchesStandaloneAI = /\bai\b/i.test(haystack);
    const matchesKeyword = matchesKeywordPhrase || matchesStandaloneAI;

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

  // Resolve elements first, before removing anything, so ancestor/descendant
  // checks below see the real, un-mutated DOM tree.
  const removeTargets = decisions
    .filter(d => d.action === "remove")
    .map(d => ({ d, el: document.querySelector(`[data-human-mode-id="${d.index}"]`) }))
    .filter(x => x.el);

  // Found on Yahoo: the model flagged both a broad wrapper div ("max-w-
  // screen-sm mx-auto" - a generic, reused layout utility class) AND the
  // actual, specific summary card nested inside it, both labeled "AI-
  // generated summary feature." Removing the outer wrapper took real
  // article paragraphs with it, since they happened to be siblings inside
  // the same generic wrapper. Fix: if one remove-target is an ancestor of
  // another remove-target, skip removing the ancestor - the more specific
  // descendant already achieves the visible removal, without the risk of
  // sweeping in unrelated content that happens to share the same wrapper.
  const skippedAncestors = new Set();
  removeTargets.forEach(({ el }) => {
    removeTargets.forEach(({ el: otherEl }) => {
      if (el !== otherEl && el.contains(otherEl)) {
        skippedAncestors.add(el);
      }
    });
  });

  removeTargets.forEach(({ d, el }) => {
    if (skippedAncestors.has(el)) {
      console.log(`[Human Mode] Skipped removing candidate ${d.index} - it's an ancestor of another removed element, removing it too could sweep in unrelated content.`);
      return;
    }
    el.style.setProperty("display", "none", "important");
    el.setAttribute("data-human-mode-removed", "agent");
    el.setAttribute("data-human-mode-reason", d.reason || "");
    removedCount++;
  });

  decisions.filter(d => d.action === "surface").forEach(d => {
    const el = document.querySelector(`[data-human-mode-id="${d.index}"]`);
    if (!el) return;
    el.style.setProperty("outline", "3px solid #2563eb", "important");
    el.style.setProperty("outline-offset", "2px", "important");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    surfacedCount++;
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