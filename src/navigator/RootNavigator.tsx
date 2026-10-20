import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Splash from "../screens/Splash";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";
import { useDispatch, useSelector } from "react-redux";
import { RootState, store } from "../Redux/store";
import {
  clearStaleAuthLoading,
  finishLogoutTransition,
  loginSuccess,
  logout,
} from "../Redux/slices/authSlice";
import { subscribeToAuthState } from "../services/authService";
import { getActiveTour } from "../services/myTourService";
import { getNativeTourLocationStatus } from "../utils/nativeTourLocation";
import { useTourTrackingLifecycle } from "../hooks/useTourTrackingLifecycle";
import { COLORS } from "../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../constants/fonts";

const RootStack = createNativeStackNavigator();

// These screens have an image or blue header behind the status bar.
// All plain/light screens use dark system icons, including password recovery.
const LIGHT_STATUS_BAR_SCREENS = new Set([
  'Login', 'Signup', 'Home', 'MyTour', 'CreateTour', 'TourSuggestion',
  'MyTourStart', 'Map', 'ForYou', 'Favorites', 'RecommendationDetials',
]);

const RootNavigator: React.FC = () => {
  const navigationRef = useNavigationContainerRef();
  const [activeScreen, setActiveScreen] = useState('Login');
  const updateActiveScreen = () => {
    const route = navigationRef.getCurrentRoute();
    if (route) setActiveScreen(route.name);
  };
  const [showSplash, setShowSplash] = useState(true);
  const [authVerified, setAuthVerified] = useState(false);
  const authVerifiedRef = useRef(false);
  const [initialNavState, setInitialNavState] = useState<any>(undefined);
  const [navStateResolved, setNavStateResolved] = useState(false);
  const dispatch = useDispatch();
  const { isLoggedIn, initialized, signingOut, user } = useSelector(
    (state: RootState) => state.auth
  );
  const userId = user?.id;
  // Wait for Firebase Auth: a persisted Redux user is not yet authenticated.
  useTourTrackingLifecycle(authVerified && initialized && isLoggedIn ? userId : undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    dispatch(clearStaleAuthLoading());
    const unsubscribe = subscribeToAuthState(
      (session) => {
        // The form owns the transition while login/signup is still in flight.
        // Firebase can notify us before the profile has been written or read.
        const authState = store.getState().auth;
        if (authState.loading || (authState.signingOut && session)) return;
        authVerifiedRef.current = true;
        setAuthVerified(true);
        if (session) {
          dispatch(loginSuccess(session));
          return;
        }
        dispatch(logout());
      },
      () => store.getState().auth.loading
    );

    return unsubscribe;
  }, [dispatch]);

  useEffect(() => {
    const bootstrapTimeout = setTimeout(() => {
      if (authVerifiedRef.current || store.getState().auth.loading) return;
      // Never display a persisted session until Firebase has confirmed it.
      authVerifiedRef.current = true;
      dispatch(logout());
      setAuthVerified(true);
    }, 5000);

    return () => clearTimeout(bootstrapTimeout);
  }, [dispatch]);

  useEffect(() => {
    if (!signingOut || isLoggedIn) return;
    // Fallback if native transitionEnd is skipped or interrupted.
    const timer = setTimeout(() => dispatch(finishLogoutTransition()), 700);
    return () => clearTimeout(timer);
  }, [dispatch, isLoggedIn, signingOut]);
  
  useEffect(() => {
    if (!authVerified || !initialized) return;
    if (!isLoggedIn || !userId) {
      setNavStateResolved(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const active = await Promise.race([
          getActiveTour(userId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        // Read the switch immediately before constructing the restored route;
        // doing this after the Firestore lookup avoids passing a stale value if
        // the user toggles Location while the splash screen is visible.
        const initialLocationStatus = active
          ? await getNativeTourLocationStatus()
          : null;
        if (cancelled) return;
        if (active) {
          setInitialNavState({
            routes: [
              {
                name: "App",
                state: {
                  routes: [
                    {
                      name: "Main",
                      state: {
                        routes: [
                          {
                            name: "Tabs",
                            state: {
                              index: 0,
                              routes: [
                                {
                                  name: "MyTours",
                                  state: {
                                    index: 1,
                                    routes: [
                                      { name: "MyTour" },
                                      {
                                        name: "MyTourStart",
                                        params: {
                                          tourId: active.id,
                                          routeId: active.route_id,
                                          tourName: active.title,
                                          autoStart: true,
                                          tourActive: true,
                                          // Resolve the Android master-location
                                          // switch during splash/bootstrap so the
                                          // active-tour screen never flashes or gets
                                          // stuck on "Getting your location" when
                                          // the app is reopened with GPS disabled.
                                          initialLocationStatusChecked: Boolean(initialLocationStatus),
                                          initialLocationUnavailable:
                                            initialLocationStatus?.locationEnabled === false,
                                        },
                                      },
                                    ],
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          });
        }
      } catch {
        // fall through to default landing
      } finally {
        if (!cancelled) setNavStateResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authVerified, initialized, isLoggedIn, userId]);

  if (showSplash || !authVerified || !initialized || (isLoggedIn && !navStateResolved)) {
    return <Splash />;
  }

  return (
    <View style={styles.root}>
      <StatusBar
        hidden={false}
        translucent
        backgroundColor="transparent"
        barStyle={signingOut ? 'dark-content' : LIGHT_STATUS_BAR_SCREENS.has(activeScreen) ? 'light-content' : 'dark-content'}
      />
      <NavigationContainer
        ref={navigationRef}
        initialState={initialNavState}
        onReady={updateActiveScreen}
        onStateChange={updateActiveScreen}
      >
        <RootStack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 220,
            contentStyle: { backgroundColor: COLORS.WHITE },
          }}
        >
          {isLoggedIn ? (
            <RootStack.Screen name="App" component={AppNavigator} />
          ) : (
            <RootStack.Screen
              name="Auth"
              component={AuthNavigator}
              listeners={{
                transitionEnd: () => {
                  if (store.getState().auth.signingOut) {
                    dispatch(finishLogoutTransition());
                  }
                },
              }}
            />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
      {signingOut && (
        <View style={styles.signOutOverlay} accessibilityViewIsModal>
          <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
          <Text style={styles.signOutText}>Signing out...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  signOutOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
  },
  signOutText: {
    marginTop: 16,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: FONT_SIZE.TEXT,
  },
});

export default RootNavigator;
