const VIEW_IDS = ['homeView', 'dashboardView', 'fittingDemoView', 'productView', 'csvImportView', 'settingView'];

const ROUTE_TO_VIEW = {
  '/': 'homeView',
  '/dashboard': 'dashboardView',
  '/dashboard.html': 'dashboardView',
  '/fitting-demo': 'fittingDemoView',
  '/fitting-demo.html': 'fittingDemoView',
  '/product': 'productView',
  '/product.html': 'productView',
  '/csv-import': 'csvImportView',
  '/csv-import.html': 'csvImportView',
  '/setting': 'settingView',
  '/setting.html': 'settingView'
};

function getEl(id) {
  return document.getElementById(id);
}

export function setShellAuthVisibility(isAuthenticated) {
  const loginView = getEl('loginView');
  const appShell = getEl('appShell');
  if (loginView) loginView.hidden = Boolean(isAuthenticated);
  if (appShell) appShell.hidden = !Boolean(isAuthenticated);
}

export function setShellView(viewId) {
  VIEW_IDS.forEach((id) => {
    const node = getEl(id);
    if (node) node.hidden = id !== viewId;
  });
}

export function resolveShellViewByPath(pathname = '/') {
  const path = String(pathname || '/').trim() || '/';
  if (ROUTE_TO_VIEW[path]) return ROUTE_TO_VIEW[path];
  return 'homeView';
}

export function setShellViewByPath(pathname = '/') {
  const viewId = resolveShellViewByPath(pathname);
  setShellView(viewId);
  return viewId;
}
