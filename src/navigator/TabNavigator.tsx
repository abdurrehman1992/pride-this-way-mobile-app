import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { CommonActions } from "@react-navigation/native";
import { CustomAlert } from "../utils/CustomAlert";
import { TabParamList } from "../types/types";
import { COLORS } from "../constants/colors";

import ForYouNavigator from "./ForYouNavigator";
import MyTourNavigator from "./MyTourNavigator";
import FovoritesNavigator from "./FovoritesNavigator";
import MapNavigator from "./MapNavigator";
import { FONT_SIZE, FONT_FAMILY } from "../constants/fonts";
import {
  BottomHeartIcon,
  BottomActiveHeart,
  BottomForYouIcon,
  BottomActvieForYou,
  BottomMyToursIcon,
  BottomActiveMyTours,
  BottomMapIcon,
  BottomActiveMapIcon,
} from "../constants/icons";

const Tab = createBottomTabNavigator<TabParamList>();
const VALID_TABS = new Set(["MyTours", "Map", "ForYou", "Favorites"]);

const getDeepestActiveRoute = (state: any): any => {
  if (!state?.routes?.length) {
    return null;
  }

  const activeRoute = state.routes[state.index ?? 0];
  if (activeRoute?.state) {
    return getDeepestActiveRoute(activeRoute.state);
  }

  return activeRoute;
};

const TAB_ICONS = {
  Favorites: {
    active: BottomActiveHeart,
    inactive: BottomHeartIcon,
  },
  ForYou: {
    active: BottomActvieForYou,
    inactive: BottomForYouIcon,
  },
  MyTours: {
    active: BottomActiveMyTours,
    inactive: BottomMyToursIcon,
  },
  Map: {
    active: BottomActiveMapIcon,
    inactive: BottomMapIcon,
  },

};

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="MyTours"
      backBehavior="history"
      screenListeners={({ navigation }) => ({
        tabPress: (event) => {
          const state = navigation.getState();
          const currentTab = state.routes[state.index ?? 0];
          const targetTab = state.routes.find((route) => route.key === event.target);

          if (!targetTab || !VALID_TABS.has(targetTab.name)) {
            return;
          }

          // Active-tour guard: if the user is currently on MyTourStart with a
          // running tour, block ALL tab switches (including back to MyTours
          // itself) until they explicitly pause. The MyTourStart screen sets
          // `tourActive: true` on its route params while the tour is running.
          const activeNestedRoute = getDeepestActiveRoute(currentTab?.state);
          const tourIsActive =
            currentTab?.name === "MyTours" &&
            activeNestedRoute?.name === "MyTourStart" &&
            activeNestedRoute?.params?.tourActive === true;

          if (tourIsActive) {
            event.preventDefault();
            CustomAlert.alert(
              "Leave Tour?",
              "Your tour is in progress. Pause it before leaving — you can resume from where you left off.",
              [
                { text: "Stay on Tour", style: "cancel" },
                {
                  text: "Pause & Leave",
                  onPress: () => {
                    // Tell MyTourStart to persist the paused state. Once it
                    // clears tourActive on its params, the user can navigate
                    // freely. We re-dispatch the tab press after a beat so
                    // the pause-save round-trip can finish.
                    navigation.dispatch(
                      CommonActions.navigate({
                        name: "MyTours",
                        params: {
                          screen: "MyTourStart",
                          params: { pauseAndLeave: Date.now() },
                        },
                      })
                    );

                    setTimeout(() => {
                      navigation.navigate(targetTab.name as never);
                    }, 350);
                  },
                },
              ]
            );
            return;
          }

          if (targetTab.name === "MyTours") {
            return;
          }

          if (currentTab?.name !== "MyTours") {
            return;
          }

          const hasUnsavedTourSuggestion =
            activeNestedRoute?.name === "TourSuggestion" &&
            activeNestedRoute?.params?.hasUnsavedChanges;

          if (!hasUnsavedTourSuggestion) {
            return;
          }

          event.preventDefault();
          CustomAlert.alert(
            "Discard Tour?",
            "You haven't saved this tour. Leaving will discard it and you'll need to create it again.",
            [
              { text: "Stay", style: "cancel" },
              {
                text: "Discard",
                style: "destructive",
                onPress: () => {
                  navigation.dispatch(
                    CommonActions.navigate({
                      name: "MyTours",
                      params: {
                        screen: "CreateTour",
                      },
                    })
                  );

                  requestAnimationFrame(() => {
                    navigation.navigate(targetTab.name as never);
                  });
                },
              },
            ]
          );
        },
      })}
      screenOptions={({ route }) => {
        const icons = TAB_ICONS[route.name as keyof typeof TAB_ICONS];

        return {
          headerShown: false,
          tabBarHideOnKeyboard: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: COLORS.BUTTON_COLOR,
          tabBarInactiveTintColor: COLORS.INACTIVE_COLOR,
          tabBarRippleColor: "transparent",

          tabBarLabel: ({ focused, color }) => (
            <Text
              style={{
                marginTop: 17,
                fontSize: FONT_SIZE.SMALL_TEXT,
                fontFamily: focused
                  ? FONT_FAMILY.InterTight_Medium
                  : FONT_FAMILY.InterTight_Regular,
                color,
              }}
            >
              {route.name}
            </Text>
          ),

          tabBarIcon: ({ focused }) => {
            const IconComponent = focused
              ? icons.active
              : icons.inactive;

            return (
              <View style={styles.iconWrapper}>
                <IconComponent width={44} height={44} />
              </View>
            );
          },
        };
      }}
    >
      <Tab.Screen name="MyTours" component={MyTourNavigator} />
      <Tab.Screen name="Map" component={MapNavigator} />
      <Tab.Screen name="ForYou" component={ForYouNavigator} />
      <Tab.Screen name="Favorites" component={FovoritesNavigator} />
    </Tab.Navigator>
  );
};

export default TabNavigator;
const styles = StyleSheet.create({
  tabBar: {
    height: 113,
    paddingTop: 11,
    paddingHorizontal: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.WHITE,
    borderTopWidth: 0,
    elevation: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
