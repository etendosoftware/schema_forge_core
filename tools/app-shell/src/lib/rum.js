import { AwsRum } from 'aws-rum-web';

export function getRumConfigs(env = import.meta.env) {
  return {
  'go.staging.etendo.cloud': {
    appMonitorId: env.VITE_RUM_APP_MONITOR_ID_STAGING,
    identityPoolId: env.VITE_RUM_IDENTITY_POOL_ID_STAGING,
  },
  'go.experimental.etendo.cloud': {
    appMonitorId: env.VITE_RUM_APP_MONITOR_ID_EXPERIMENTAL,
    identityPoolId: env.VITE_RUM_IDENTITY_POOL_ID_EXPERIMENTAL,
  },
};
}

export function resolveRumConfig(hostname, env = import.meta.env) {
  return getRumConfigs(env)[hostname];
}

export function createRumProvider({
  hostname = globalThis.window?.location?.hostname,
  env = import.meta.env,
  AwsRumCtor = AwsRum,
  logger = console,
  enabled = true,
} = {}) {
  const config = resolveRumConfig(hostname, env);

  return {
    name: 'aws-rum',
    enabled: enabled && Boolean(config?.appMonitorId && config?.identityPoolId),

    init() {
      if (!config?.appMonitorId || !config?.identityPoolId) return;

      try {
        new AwsRumCtor(config.appMonitorId, '1.0.0', 'eu-west-3', {
          sessionSampleRate: 1,
          identityPoolId: config.identityPoolId,
          endpoint: 'https://dataplane.rum.eu-west-3.amazonaws.com',
          telemetries: ['performance', 'errors', 'http'],
          allowCookies: true,
          enableXRay: false,
        });
      } catch (e) {
        logger.warn('CloudWatch RUM init failed', e);
      }
    },
  };
}

export function initRum(options = {}) {
  return createRumProvider(options).init();
}
