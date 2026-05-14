import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DrawerNavigator from "./DrawerNavigator";
import { AppStackParamList } from "../types/types";
import AddLocations from "../screens/main/AddLocations";
const Stack = createNativeStackNavigator<AppStackParamList>();
const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={DrawerNavigator} />
    </Stack.Navigator>
  );
};
export default AppNavigator;

