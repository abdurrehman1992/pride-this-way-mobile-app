import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SupportParamList } from "../types/types";
import Support from "../screens/Support/Support";
import Conditions from "../screens/Support/Conditions";
const Stack = createNativeStackNavigator<SupportParamList>();
const SupportNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Help_Support" component={Support} />
      <Stack.Screen name="Terms_Conditions" component={Conditions} />
    </Stack.Navigator>
  );
};

export default SupportNavigator;