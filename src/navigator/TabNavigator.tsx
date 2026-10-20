import React from "react";
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  CommonActions,
  getFocusedRouteNameFromRoute,
} from "@react-navigation/native";
import { CustomAlert } from "../utils/CustomAlert";
import { TabParamList } from "../types/types";
import { COLORS } from "../constants/colors";
import { TAB_TRANSITION_DURATION_MS } from "../constants/navigation";

import ForYouNavigator from "./ForYouNavigator";
import MyTourNavigator from "./MyTourNavigator";
import FavoritesNavigator from "./FavoritesNavigator";
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
const NoFeedbackTabButton = (props: any) => (
  <TouchableOpacity {...props} activeOpacity={1} />
);

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

type TabName = keyof typeof TAB_ICONS;

const createTabContent = (name: TabName) => ({
  tabBarLabel: ({ focused }: { focused: boolean }) => (
    <Text
      style={[styles.tabLabel, focused ? styles.tabLabelActive : styles.tabLabelInactive]}
    >
      {name}
    </Text>
  ),
  tabBarIcon: ({ focused }: { focused: boolean }) => {
    const Icon = focused ? TAB_ICONS[name].active : TAB_ICONS[name].inactive;
    return (
      <View style={styles.iconWrapper}>
        <Icon width={44} height={44} />
      </View>
    );
  },
});

const TAB_CONTENT = {
  MyTours: createTabContent("MyTours"),
  Map: createTabContent("Map"),
  ForYou: createTabContent("ForYou"),
  Favorites: createTabContent("Favorites"),
};

// Keep the arriving scene opaque so a loading state on the previous tab
// cannot show through while switching tabs.
const forOpaqueTabShift: NonNullable<
  BottomTabNavigationOptions['sceneStyleInterpolator']
> = ({ current }) => ({
  sceneStyle: {
    transform: [{
      translateX: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [-20, 0, 20],
      }),
    }],
  },
});

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
            // Tapping the already-selected tab normally pops its nested stack
            // to the first MyTour route. After creating a tour that first
            // route can still be the old "No Tours Yet" screen, while the
            // current nested route correctly shows the saved card. Keep the
            // current MyTours route instead of performing that pop.
            if (currentTab?.name === "MyTours") {
              event.preventDefault();
            }
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
        const focusedNestedRouteName = getFocusedRouteNameFromRoute(route);
        const hideTabsForTourNavigation =
          route.name === "MyTours" &&
          (focusedNestedRouteName === "MyTourStart" || focusedNestedRouteName === "AddLocations");

        return {
          headerShown: false,
          animation: "shift",
          sceneStyleInterpolator: forOpaqueTabShift,
          transitionSpec: {
            animation: "timing",
            config: { duration: TAB_TRANSITION_DURATION_MS },
          },
          freezeOnBlur: true,
          tabBarHideOnKeyboard: false,
          tabBarStyle: hideTabsForTourNavigation
            ? styles.hiddenTabBar
            : styles.tabBar,
          tabBarActiveTintColor: COLORS.BUTTON_COLOR,
          tabBarInactiveTintColor: COLORS.INACTIVE_COLOR,
          tabBarRippleColor: "transparent",
          tabBarActiveBackgroundColor: "transparent",
          tabBarInactiveBackgroundColor: "transparent",
          tabBarButton: NoFeedbackTabButton,
          ...TAB_CONTENT[route.name as TabName],
        };
      }}
    >
      <Tab.Screen name="MyTours" component={MyTourNavigator} />
      <Tab.Screen name="Map" component={MapNavigator} options={{ lazy: false }} />
      <Tab.Screen name="ForYou" component={ForYouNavigator} options={{ lazy: false }} />
      <Tab.Screen name="Favorites" component={FavoritesNavigator} />
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
  hiddenTabBar: {
    display: "none",
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    marginTop: 17,
    fontSize: FONT_SIZE.SMALL_TEXT,
  },
  tabLabelActive: {
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.BUTTON_COLOR,
  },
  tabLabelInactive: {
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.INACTIVE_COLOR,
  },
});
