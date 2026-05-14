import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ForYouStackParamList } from "../types/types";
import Home from "../screens/main/Home";
import ForYou from "../screens/main/ForYou";
import RecommendationDetials from '../screens/main/RecommendationDetials'
const Stack = createNativeStackNavigator<ForYouStackParamList>();
const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ForYou" component={ForYou} />
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="RecommendationDetials" component={RecommendationDetials} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;