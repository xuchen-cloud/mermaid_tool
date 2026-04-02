export const app = {
  dom: null,
  state: null,
  documentCache: null,
  i18n: null,
  desktopApi: null,
  modules: {}
};

export function initializeAppContext({ dom, state, documentCache, i18n, desktopApi }) {
  app.dom = dom;
  app.state = state;
  app.documentCache = documentCache;
  app.i18n = i18n;
  app.desktopApi = desktopApi;
}
