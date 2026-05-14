import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AddLocations from "../screens/main/AddLocations";
import { MyTourStackParamList } from "../types/types";
import MyTour from "../screens/main/MyTour";
import MyTourStart from "../screens/main/MyTourStart";
import RecommendationDetials from "../screens/main/RecommendationDetials";
const Stack = createNativeStackNavigator<MyTourStackParamList>();
const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyTour" component={MyTour} />
      <Stack.Screen name="AddLocations" component={AddLocations} />
      <Stack.Screen name="MyTourStart" component={MyTourStart} />
      <Stack.Screen name="RecommendationDetials" component={RecommendationDetials} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;