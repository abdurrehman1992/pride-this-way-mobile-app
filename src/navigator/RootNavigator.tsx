import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import Splash from "../screens/Splash";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
const RootNavigator: React.FC = () => {
  // const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const isLoggedIn = useSelector(
    (state: RootState) => state.auth.isLoggedIn
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
  if (showSplash) return <Splash />;
  return (
    <NavigationContainer>
      {isLoggedIn ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;