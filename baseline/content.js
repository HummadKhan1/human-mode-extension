// Human Mode - Baseline
// Hardcoded selectors for exactly the 4 sites we manually inspected via DevTools.
// This is intentionally "dumb" - it represents what existing tools like
// "Bye Bye Google AI" or "EAI - Eliminate AI" do: a per-site selector list
// that breaks the moment a site redesigns, and does nothing at all on any
// site it wasn't specifically written for.

const SITE_RULES = [
  {
    name: "amazon",
    hostnameIncludes: "amazon.",
    remove: [
      { selector: "#nav-rufus-disco-avatar" },
      { selector: "#nav-rufus-disco-text" }
    ]
  },
  {
    name: "google_search",
    hostnameIncludes: "google.",
    remove: [
      // Google's class names (e.g. "Fzsovc") are obfuscated/build-specific and
      // change between deploys, so we match by role + aria-level + text instead.
      { selector: '[role="heading"][aria-level="2"]', textMatch: "AI Overview", removeAncestorLevels: 3 }
    ]
  },
  {
    name: "bing",
    hostnameIncludes: "bing.",
    remove: [
      { selector: ".devmag_cntnt_snip", removeAncestorLevels: 2 },
      { selector: ".rd_cnt_srcs" }
    ]
  },
  {
    name: "zendesk",
    hostnameIncludes: "zendesk.",
    remove: [
      { selector: 'iframe[title*="launch messaging" i]' }
    ]
  }
];

function applyBaseline() {
  const host = window.location.hostname;
  const rule = SITE_RULES.find(r => host.includes(r.hostnameIncludes));

  if (!rule) {
    console.log(`[Human Mode - Baseline] No hardcoded rules for "${host}". This site is untouched.`);
    return { matched: false, site: null, removedCount: 0 };
  }

  let removedCount = 0;
  rule.remove.forEach(r => {
    let els;
    try {
      els = document.querySelectorAll(r.selector);
    } catch (e) {
      console.log(`[Human Mode - Baseline] Selector failed: ${r.selector}`, e);
      return;
    }
    els.forEach(el => {
      if (r.textMatch && !el.textContent.includes(r.textMatch)) return;

      let target = el;
      if (r.removeAncestorLevels) {
        for (let i = 0; i < r.removeAncestorLevels; i++) {
          if (target.parentElement) target = target.parentElement;
        }
      }
      target.style.setProperty("display", "none", "important");
      target.setAttribute("data-human-mode-removed", "baseline");
      removedCount++;
    });
  });

  console.log(`[Human Mode - Baseline] Matched rule "${rule.name}". Removed ${removedCount} element(s).`);
  return { matched: true, site: rule.name, removedCount };
}

chrome.storage.local.get(["humanModeEnabled"], (data) => {
  if (data.humanModeEnabled === false) return; // default: on
  const result = applyBaseline();
  chrome.storage.local.set({
    [`baseline_lastResult_${window.location.hostname}`]: { ...result, timestamp: Date.now() }
  });
});
