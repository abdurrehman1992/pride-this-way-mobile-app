import { Linking, Platform } from 'react-native';
import { CustomAlert } from './CustomAlert';

export const openInternetSettings = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.WIRELESS_SETTINGS');
      return;
    } catch {
      // Fall through to app settings on devices without this intent.
    }
  }
  await Linking.openSettings();
};

type InternetRequiredAlertOptions = {
  /** Active tours must stay blocked; pre-start/resume checks may be cancelled. */
  blocking?: boolean;
  /** Label for the dismiss action when the alert is not blocking. */
  closeLabel?: string;
};

export const showInternetRequiredAlert = (
  options: InternetRequiredAlertOptions = {},
): void => {
  const blocking = options.blocking !== false;
  const buttons = blocking
    ? [{
        text: 'Open Internet Settings',
        onPress: openInternetSettings,
        dismissOnPress: false,
      }]
    : [
        { text: options.closeLabel || 'Cancel', style: 'cancel' as const },
        {
          text: 'Open Internet Settings',
          onPress: openInternetSettings,
        },
      ];

  CustomAlert.alert(
    'You Are Offline',
    'Turn on Wi-Fi or mobile data to continue using this tour.',
    buttons,
    { dismissible: !blocking },
  );
};
