import { AlertButton } from '../context/AlertContext';

let showAlertFn: ((title: string, message: string, buttons: AlertButton[]) => void) | null = null;

export const setShowAlertFunction = (
  fn: (title: string, message: string, buttons: AlertButton[]) => void
) => {
  showAlertFn = fn;
};

/**
 * Drop-in replacement for Alert.alert()
 * Usage: CustomAlert.alert('Title', 'Message', [{text: 'OK', onPress: () => {}}])
 */
export const CustomAlert = {
  alert: (
    title: string,
    message: string = '',
    buttons: AlertButton[] = [{ text: 'OK', style: 'cancel' }]
  ) => {
    if (!showAlertFn) {
      console.warn('CustomAlert not initialized. Make sure AlertProvider is wrapping your app.');
      return;
    }
    showAlertFn(title, message, buttons);
  },
};
