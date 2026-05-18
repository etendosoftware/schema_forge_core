import { createShellClient } from '@etendoerp/apps-sdk';

function readToken() {
  const url = new URL(window.location.href);
  return url.searchParams.get('jwt') || '';
}

export const shell = createShellClient({ appId: 'spike-hello-app', token: readToken() });
export const fetchEtendo = (path, opts) => shell.fetch(path, opts);
export const fetchMe = () => shell.me();
