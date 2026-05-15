import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import Splash from "../screens/Splash";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../Redux/store";
import {
  loginSuccess,
  logout,
  setAuthInitialized,
} from "../Redux/slices/authSlice";
import { subscribeToAuthState } from "../services/authService";
const RootNavigator: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const dispatch = useDispatch();
  const { isLoggedIn, initialized } = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((session) => {
      if (session) {
        dispatch(loginSuccess(session));
        return;
      }

      dispatch(logout());
    });

    return unsubscribe;
  }, [dispatch]);

  useEffect(() => {
    const bootstrapTimeout = setTimeout(() => {
      dispatch(setAuthInitialized());
    }, 5000);

    return () => clearTimeout(bootstrapTimeout);
  }, [dispatch]);

  if (showSplash || !initialized) return <Splash />;
  return (
    <NavigationContainer>
      {isLoggedIn ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;
