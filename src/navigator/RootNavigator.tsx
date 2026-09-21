import React, { useEffect, useState } from "react";
import { StatusBar } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import Splash from "../screens/Splash";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../Redux/store";
import {
  loginSuccess,
  logout,
  setAuthInitialized,
} from "../Redux/slices/authSlice";
import { subscribeToAuthState } from "../services/authService";
import { getActiveTour } from "../services/myTourService";
import { getNativeTourLocationStatus } from "../utils/nativeTourLocation";
import { useTourTrackingLifecycle } from "../hooks/useTourTrackingLifecycle";

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
  const [initialNavState, setInitialNavState] = useState<any>(undefined);
  const [navStateResolved, setNavStateResolved] = useState(false);
  const dispatch = useDispatch();
  const { isLoggedIn, initialized, user } = useSelector(
    (state: RootState) => state.auth
  );
  const userId = user?.id;
  // Wait for Firebase Auth: a persisted Redux user is not yet authenticated.
  useTourTrackingLifecycle(initialized && isLoggedIn ? userId : undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((session) => {
      if (session) {
        dispatch(loginSuccess(session));
        return;
      }
      dispatch(logout());
    });

    return unsubscribe;
  }, [dispatch]);

  useEffect(() => {
    const bootstrapTimeout = setTimeout(() => {
      dispatch(setAuthInitialized());
    }, 5000);

    return () => clearTimeout(bootstrapTimeout);
  }, [dispatch]);
  
  useEffect(() => {
    if (!initialized) return;
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
  }, [initialized, isLoggedIn, userId]);

  if (showSplash || !initialized || (isLoggedIn && !navStateResolved)) {
    return <Splash />;
  }

  return (
    <>
      <StatusBar
        hidden={false}
        translucent
        backgroundColor="transparent"
        barStyle={LIGHT_STATUS_BAR_SCREENS.has(activeScreen) ? 'light-content' : 'dark-content'}
      />
      <NavigationContainer
        ref={navigationRef}
        initialState={initialNavState}
        onReady={updateActiveScreen}
        onStateChange={updateActiveScreen}
      >
        {isLoggedIn ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </>
  );
};

export default RootNavigator;
