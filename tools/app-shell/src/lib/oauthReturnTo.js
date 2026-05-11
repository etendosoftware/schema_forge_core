export const DEFAULT_AUTH_RETURN_TO = '/dashboard';

export function buildOnboardingReturnTo(location) {
  const pathname = location?.pathname || '/';
  const search = location?.search || '';
  const hash = location?.hash || '';
  const params = new URLSearchParams({ returnTo: `${pathname}${search}${hash}` });
  return `/onboarding?${params.toString()}`;
}

export function getSafeReturnTo(search, fallback = DEFAULT_AUTH_RETURN_TO) {
  const params = new URLSearchParams(search || '');
  const returnTo = params.get('returnTo');
  return isSafeLocalReturnTo(returnTo) ? returnTo : fallback;
}

export function isSafeLocalReturnTo(value) {
  if (typeof value !== 'string') return false;
  const target = value.trim();
  if (!target.startsWith('/')) return false;
  if (target.startsWith('//')) return false;
  if (target.includes('\\')) return false;
  if (/^\/(?:onboarding|login)(?:[/?#]|$)/.test(target)) return false;
  return true;
}
