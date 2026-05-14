import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "../screens/auth/Login";
import Signup from "../screens/auth/Signup";
import ForgetPassword from "../screens/auth/ForgetPassword/ForgetPassword";
import EnterCode from "../screens/auth/ForgetPassword/EnterCode";
import CreateNewPassword from "../screens/auth/ForgetPassword/CreateNewPassword";
import { AuthStackParamList } from "../types/types";

const Stack = createNativeStackNavigator<AuthStackParamList>();
const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Signup" component={Signup} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="ForgetPassword" component={ForgetPassword} />
      <Stack.Screen name="EnterCode" component={EnterCode} />
      <Stack.Screen name="CreateNewPassword" component={CreateNewPassword} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;