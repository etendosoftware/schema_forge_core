function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizePath(path, fallback = '/') {
  if (!path) return fallback;
  return path.startsWith('/') ? path : `/${path}`;
}

export function createMenuItem({ id, label, path, icon, external = false, meta = {} }) {
  invariant(label, 'Menu items require a label');
  invariant(path || id, 'Menu items require a path or id');

  return {
    id: id || path,
    label,
    path: path ? normalizePath(path) : undefined,
    icon,
    external: Boolean(external),
    meta,
  };
}

export function createMenuGroup({ id, title, items = [], meta = {} }) {
  invariant(title || id, 'Menu groups require a title or id');

  return {
    id: id || title,
    title: title || id,
    items: items.map(createMenuItem),
    meta,
  };
}

export function normalizeMenuGroups(groups = []) {
  invariant(Array.isArray(groups), 'menuGroups must be an array');
  return groups.map(createMenuGroup);
}

export function createReportDescriptor({ id, title, params = {}, format = 'pdf', baseUrl }) {
  invariant(id, 'Reports require an id');
  return {
    id,
    title: title || id,
    params,
    format,
    baseUrl,
  };
}

export function normalizeReports(reports = []) {
  invariant(Array.isArray(reports), 'reports must be an array');
  return reports.map(createReportDescriptor);
}

export function createRuntimeRoute({ path, element, public: isPublic = false, index = false }) {
  invariant(index || path, 'Routes require a path unless index is true');
  invariant(element, 'Routes require an element');

  return {
    path: index ? undefined : normalizePath(path).replace(/^\//, ''),
    element,
    public: Boolean(isPublic),
    index: Boolean(index),
  };
}

export function createAppShellConfig({
  menuGroups = [],
  reports = [],
  routes = [],
  auth = {},
  theme = {},
} = {}) {
  return {
    menuGroups: normalizeMenuGroups(menuGroups),
    reports: normalizeReports(reports),
    routes: routes.map(createRuntimeRoute),
    auth,
    theme,
  };
}
