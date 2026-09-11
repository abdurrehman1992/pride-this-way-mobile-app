import { AlertButton } from '../context/AlertContext';

let showAlertFn: ((title: string, message: string, buttons: AlertButton[], options?: { dismissible?: boolean }) => void) | null = null;
let hideAlertFn: (() => void) | null = null;

export const setShowAlertFunction = (
  fn: (title: string, message: string, buttons: AlertButton[], options?: { dismissible?: boolean }) => void,
  hideFn?: () => void,
) => {
  showAlertFn = fn;
  hideAlertFn = hideFn || null;
};

/**
 * Drop-in replacement for Alert.alert()
 * Usage: CustomAlert.alert('Title', 'Message', [{text: 'OK', onPress: () => {}}])
 */
export const CustomAlert = {
  alert: (
    title: string,
    message: string = '',
    buttons: AlertButton[] = [{ text: 'OK', style: 'cancel' }],
    options?: { dismissible?: boolean },
  ) => {
    if (!showAlertFn) {
      console.warn('CustomAlert not initialized. Make sure AlertProvider is wrapping your app.');
      return;
    }
    showAlertFn(title, message, buttons, options);
  },
  dismiss: () => hideAlertFn?.(),
};
