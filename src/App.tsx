import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { store, persistor } from "./Redux/store";
import RootNavigator from './navigator/RootNavigator';
import { PersistGate } from "redux-persist/integration/react";
import Toast from "react-native-toast-message";
import { toastConfig } from "./utils/toastConfig";
import { FavoritesProvider } from "./context/FavoritesContext";
import { AlertProvider } from "./context/AlertContext";
import CustomAlertModal from "./components/modals/CustomAlertModal";
import { useInternetConnectivity } from './utils/networkStatus';
import { CustomAlert } from './utils/CustomAlert';

const App = () => {
  const isOnline = useInternetConnectivity();

  useEffect(() => {
    if (!isOnline) {
      CustomAlert.alert(
        'No Internet Connection',
        'Please connect to the internet to continue using AI-powered verification.',
        [{ text: 'OK', style: 'cancel' }]
      );
    }
  }, [isOnline]);

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <FavoritesProvider>
            <AlertProvider>
              <SafeAreaProvider>
                <RootNavigator />
                <CustomAlertModal />
                <Toast config={toastConfig} />
              </SafeAreaProvider>
            </AlertProvider>
          </FavoritesProvider>
        </PersistGate>
      </Provider>
    </SafeAreaProvider>
  );
};

export default App;
