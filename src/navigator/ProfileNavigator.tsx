import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileStackParamList } from "../types/types";
import Profile from "../screens/main/Profile";
import EditProfile from "../screens/main/EditProfile";
import ChangePassword from "../screens/main/ChangePassword";
const Stack = createNativeStackNavigator<ProfileStackParamList>();
const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="ChangePassword" component={ChangePassword} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;