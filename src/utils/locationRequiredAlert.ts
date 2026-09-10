import { Linking, Platform } from 'react-native';
import { CustomAlert } from './CustomAlert';

export const openDeviceLocationSettings = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      return;
    } catch {
      // Fall back to the app settings page if the device does not expose the
      // Android location-source intent.
    }
  }

  await Linking.openSettings();
};

/**
 * Keep the start/resume gate and the active-tour GPS-off warning identical.
 */
export const showLocationRequiredAlert = (): void => {
  CustomAlert.alert(
    'Location Required',
    'Turn on device location and allow location permission before starting or resuming this tour.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: openDeviceLocationSettings,
      },
    ],
  );
};
