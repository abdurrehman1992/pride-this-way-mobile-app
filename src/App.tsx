import React from "react";
import { Provider } from "react-redux";
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { store, persistor } from "./Redux/store";
import RootNavigator from './navigator/RootNavigator';
import { PersistGate } from "redux-persist/integration/react";
import Toast from "react-native-toast-message";
import { toastConfig } from "./utils/toastConfig";
import { FavoritesProvider } from "./context/FavoritesContext";
const App = () => {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <FavoritesProvider>
            <SafeAreaProvider>
              <RootNavigator />
              <Toast config={toastConfig} />
            </SafeAreaProvider>
          </FavoritesProvider>
        </PersistGate>
      </Provider>
    </SafeAreaProvider>
  );
};

export default App;
