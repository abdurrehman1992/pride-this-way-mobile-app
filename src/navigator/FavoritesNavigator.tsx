import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FavoritesStackParamList } from "../types/types";
import Favorites from "../screens/main/Favorites";
import RecommendationDetials from "../screens/main/RecommendationDetials";
const Stack = createNativeStackNavigator<FavoritesStackParamList>();
const FavoritesNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Favorites" component={Favorites} />
      <Stack.Screen name="RecommendationDetials" component={RecommendationDetials} />
    </Stack.Navigator>
  );
};

export default FavoritesNavigator;
