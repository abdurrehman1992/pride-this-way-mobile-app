import { NativeEventEmitter, NativeModules } from 'react-native';

type HeadingEvent = {
  heading?: number;
};

const headingModule = NativeModules.TourHeading;

export const subscribeToDeviceHeading = (
  listener: (heading: number) => void,
) => {
  if (!headingModule?.startHeading) {
    return { remove: () => undefined };
  }

  const emitter = new NativeEventEmitter(headingModule);
  const subscription = emitter.addListener(
    'TourHeadingEvent',
    (event: HeadingEvent) => {
      const heading = Number(event?.heading);
      if (Number.isFinite(heading) && heading >= 0 && heading < 360) {
        listener(heading);
      }
    },
  );
  headingModule.startHeading().catch(() => undefined);

  return {
    remove: () => {
      subscription.remove();
      headingModule.stopHeading?.().catch(() => undefined);
    },
  };
};
