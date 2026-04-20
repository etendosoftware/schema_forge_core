import { AwsRum } from 'aws-rum-web';

const CONFIGS = {
  'go.staging.etendo.cloud': {
    appMonitorId: import.meta.env.VITE_RUM_APP_MONITOR_ID_STAGING,
    identityPoolId: import.meta.env.VITE_RUM_IDENTITY_POOL_ID_STAGING,
  },
  'go.experimental.etendo.cloud': {
    appMonitorId: import.meta.env.VITE_RUM_APP_MONITOR_ID_EXPERIMENTAL,
    identityPoolId: import.meta.env.VITE_RUM_IDENTITY_POOL_ID_EXPERIMENTAL,
  },
};

export function initRum() {
  const config = CONFIGS[window.location.hostname];
  if (!config?.appMonitorId || !config?.identityPoolId) return;

  try {
    new AwsRum(config.appMonitorId, '1.0.0', 'eu-west-3', {
      sessionSampleRate: 1,
      identityPoolId: config.identityPoolId,
      endpoint: 'https://dataplane.rum.eu-west-3.amazonaws.com',
      telemetries: ['performance', 'errors', 'http'],
      allowCookies: true,
      enableXRay: false,
    });
  } catch (e) {
    console.warn('CloudWatch RUM init failed', e);
  }
}
