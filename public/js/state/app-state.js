const appState = {
  currentLang: 'en',
  currentMode: 'demo',
  currentProductSummaryView: 'nested',
  session: null,
  connectionStatus: 'idle',
  supabaseClient: null
};

export function getAppState() {
  return appState;
}

export function setAppState(patch = {}) {
  Object.assign(appState, patch || {});
  return appState;
}

