import React from 'react';
import { Dimensions } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';

import TabNavigator from './TabNavigator';
import CustomDrawer from '../components/Drawer/CustomDrawer';
import RewardsNavigator from './RewardsNavigator';
import FavoritesNavigator from './FavoritesNavigator';
import ProfileNavigator from './ProfileNavigator';
import Support from '../screens/Support/Support';
import Conditions from '../screens/Support/Conditions';
import { COLORS } from '../constants/colors';

const Drawer = createDrawerNavigator();
const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 340);
const renderDrawerContent = (props: any) => <CustomDrawer {...props} />;

const DrawerNavigator = () => {
  // Android can briefly show a blank tab scene when the native drawer overlay
  // closes. Keeping drawer scenes attached avoids that one-frame gap.
  return (
    <Drawer.Navigator
      backBehavior="history"
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,

        drawerType: 'front',

        swipeEnabled: false,

        overlayColor: 'rgba(0,0,0,0.25)',
        sceneStyle: { backgroundColor: COLORS.WHITE },
        drawerStyle: {
          width: DRAWER_WIDTH,
          backgroundColor: COLORS.WHITE,
        },

        lazy: true,

        // 🔥 IMPORTANT PERFORMANCE FLAGS
        freezeOnBlur: true,
      }}
      drawerContent={renderDrawerContent}
    >
      <Drawer.Screen name="Tabs" component={TabNavigator} />
      <Drawer.Screen name="Favorites" component={FavoritesNavigator} />
      <Drawer.Screen name="Rewards" component={RewardsNavigator} />
      <Drawer.Screen name="Profile" component={ProfileNavigator} />
      <Drawer.Screen name="Support" component={Support} />
      <Drawer.Screen name="Terms" component={Conditions} />
    </Drawer.Navigator>
  );
};

export default React.memo(DrawerNavigator);
