import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FovoritesStackParamList } from "../types/types";
import Favorites from "../screens/main/Favorites";
const Stack = createNativeStackNavigator<FovoritesStackParamList>();
const FovoritesNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Favorites" component={Favorites} />
    </Stack.Navigator>
  );
};

export default FovoritesNavigator;