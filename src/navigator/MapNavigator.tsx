import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MapStackParamList } from "../types/types";
import Favorites from "../screens/main/Favorites";
import Map from "../screens/main/Map";
const Stack = createNativeStackNavigator<MapStackParamList>();
const MapNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Map" component={Map} />
    </Stack.Navigator>
  );
};

export default MapNavigator;