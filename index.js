/**
 * @format
 */
import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './src/App';
import { name as appName } from './app.json';

// Must be registered outside the React tree. Tour tracking alerts are
// notification messages that the OS displays itself while the app is in the
// background or closed, so there is nothing to process here.
messaging().setBackgroundMessageHandler(async () => {});

AppRegistry.registerComponent(appName, () => App);
