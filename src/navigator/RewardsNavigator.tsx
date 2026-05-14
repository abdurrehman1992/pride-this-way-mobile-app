import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RewardsStackParamList } from "../types/types";
import Rewards from "../screens/main/Rewards";
const Stack = createNativeStackNavigator<RewardsStackParamList>();
const RewardsNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Rewards" component={Rewards} />
    </Stack.Navigator>
  );
};

export default RewardsNavigator;