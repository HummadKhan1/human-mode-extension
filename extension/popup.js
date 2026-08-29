const toggle = document.getElementById("toggle");
const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("model");
const saveBtn = document.getElementById("save");
const saveNote = document.getElementById("saveNote");
const statusEl = document.getElementById("status");

// Load stored settings
chrome.storage.local.get(["humanModeEnabled", "apiKey", "model"], (data) => {
  toggle.checked = data.humanModeEnabled !== false; // default on
  if (data.apiKey) apiKeyInput.value = data.apiKey;
  if (data.model) modelSelect.value = data.model;
});

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ humanModeEnabled: toggle.checked });
});

saveBtn.addEventListener("click", () => {
  chrome.storage.local.set(
    { apiKey: apiKeyInput.value.trim(), model: modelSelect.value },
    () => {
      saveNote.textContent = "Saved. Reload the page to apply.";
      setTimeout(() => (saveNote.textContent = ""), 2500);
    }
  );
});

// Show last result for the active tab's hostname
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab || !tab.url) return;
  let hostname;
  try {
    hostname = new URL(tab.url).hostname;
  } catch (e) {
    return;
  }

  chrome.storage.local.get([`lastResult_${hostname}`], (data) => {
    const result = data[`lastResult_${hostname}`];
    if (!result) {
      statusEl.innerHTML = `<p class="status-line">No result yet for <strong>${hostname}</strong>. Reload the page.</p>`;
      return;
    }
    if (result.error) {
      statusEl.innerHTML = `<p class="status-line">Error on <strong>${hostname}</strong>: ${result.error}</p>`;
      return;
    }
    statusEl.innerHTML = `
      <p class="status-line"><strong>${hostname}</strong></p>
      <p class="status-line">Removed: ${result.removedCount} · Surfaced: ${result.surfacedCount}</p>
      <p class="status-line">Candidates checked: ${result.candidateCount} · Rejected (unverified): ${result.rejectedCount}</p>
    `;
  });
});
