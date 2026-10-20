import { NativeEventEmitter, NativeModules } from 'react-native';

type AmbientLightEvent = {
  lux?: number;
};

const ambientLightModule = NativeModules.AmbientLight;

export const subscribeToAmbientLight = (listener: (lux: number) => void) => {
  if (!ambientLightModule?.start) {
    console.warn('[AmbientLight] Native light sensor module unavailable');
    return { remove: () => undefined };
  }

  const emitter = new NativeEventEmitter(ambientLightModule);
  const subscription = emitter.addListener(
    'AmbientLightEvent',
    (event: AmbientLightEvent) => {
      const lux = Number(event?.lux);
      if (Number.isFinite(lux) && lux >= 0) {
        listener(lux);
      }
    },
  );
  ambientLightModule.start().catch((error: unknown) => {
    console.warn('[AmbientLight] Could not start sensor:', error);
  });

  return {
    remove: () => {
      subscription.remove();
      ambientLightModule.stop?.().catch(() => undefined);
    },
  };
};
