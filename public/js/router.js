const listeners = new Set();

function normalizePath(inputPath = '/') {
  const raw = String(inputPath || '/').trim();
  if (!raw) return '/';
  const [pathname] = raw.split('?');
  let normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || '/';
}

function emit(path, state = window.history.state || null) {
  const normalized = normalizePath(path);
  listeners.forEach((handler) => {
    try {
      handler({ path: normalized, state });
    } catch (error) {
      console.error('[router] listener failed', error);
    }
  });
}

export function getCurrentPath() {
  return normalizePath(window.location.pathname);
}

export function navigate(path, options = {}) {
  const { replace = false, state = null } = options;
  const target = normalizePath(path);
  if (target === getCurrentPath()) {
    emit(target, state);
    return;
  }
  if (replace) {
    window.history.replaceState(state, '', target);
  } else {
    window.history.pushState(state, '', target);
  }
  emit(target, state);
}

export function onRouteChange(handler) {
  if (typeof handler !== 'function') return () => {};
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function startRouter() {
  window.addEventListener('popstate', (event) => {
    emit(window.location.pathname, event.state);
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-route-link]');
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http')) return;
    event.preventDefault();
    navigate(href);
  });

  emit(getCurrentPath(), window.history.state || null);
}

export { normalizePath };

