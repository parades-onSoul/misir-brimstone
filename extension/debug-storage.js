async function loadStorage() {
  const all = await chrome.storage.local.get(null);
  document.getElementById('output').textContent = JSON.stringify(all, null, 2);
}

async function clearAuth() {
  await chrome.storage.local.remove(['misir_session', 'userId']);
  document.getElementById('output').textContent =
    'Auth cleared. Click Load Storage to verify.';
}

async function clearAll() {
  await chrome.storage.local.clear();
  document.getElementById('output').textContent =
    'All storage cleared. Extension will reinitialize on next load.';
}

document.addEventListener('DOMContentLoaded', () => {
  const loadBtn = document.getElementById('load-storage');
  const clearAuthBtn = document.getElementById('clear-auth');
  const clearAllBtn = document.getElementById('clear-all');

  if (loadBtn) loadBtn.addEventListener('click', loadStorage);
  if (clearAuthBtn) clearAuthBtn.addEventListener('click', clearAuth);
  if (clearAllBtn) clearAllBtn.addEventListener('click', clearAll);

  loadStorage();
});
