import React from 'react';
import { Dimensions } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';

import TabNavigator from './TabNavigator';
import CustomDrawer from '../components/Drawer/CustomDrawer';
import RewardsNavigator from './RewardsNavigator';
import FavoritesNavigator from './FovoritesNavigator';
import ProfileNavigator from './ProfileNavigator';

const Drawer = createDrawerNavigator();
const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 340);
const renderDrawerContent = (props: any) => <CustomDrawer {...props} />;

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,

        drawerType: 'front',

        swipeEnabled: false,

        overlayColor: 'rgba(0,0,0,0.25)',
        drawerStyle: {
          width: DRAWER_WIDTH,
        },

        lazy: true,

        // 🔥 IMPORTANT PERFORMANCE FLAGS
        freezeOnBlur: true,
        detachInactiveScreens: true,
      }}
      drawerContent={renderDrawerContent}
    >
      <Drawer.Screen name="Tabs" component={TabNavigator} />
      <Drawer.Screen name="Favorites" component={FavoritesNavigator} />
      <Drawer.Screen name="Rewards" component={RewardsNavigator} />
      <Drawer.Screen name="Profile" component={ProfileNavigator} />
    </Drawer.Navigator>
  );
};

export default React.memo(DrawerNavigator);
