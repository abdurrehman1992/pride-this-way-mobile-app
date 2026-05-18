import React, { useCallback } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
} from 'react-native';

import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';

import { BgFrame, PROFILE_IMAGE } from '../../constants/images';

import {
  BottomProfileIcon,
  CloseIcon,
  HelpIcon,
  LogoutIcon,
  RewardsIcon,
  TermsIcon,
} from '../../constants/icons';

import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { logout } from '../../Redux/slices/authSlice';
import { RootState } from '../../Redux/store';
import { logoutUser } from '../../services/authService';
import { showError } from '../common/AppToast';

import TabsButtons from '../common/TabsButtons';

const CustomDrawer = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const user = useSelector((state: RootState) => state.auth.user);
  const navigateTo = useCallback(
    (screen: string, params?: any) => {
      navigation.navigate(screen, params);

      requestAnimationFrame(() => {
        navigation.closeDrawer();
      });
    },
    [navigation],
  );

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
      dispatch(logout());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to logout.';
      showError('Logout Failed', message);
    }
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={BgFrame}
        style={styles.topHeader}
        imageStyle={styles.headerImage}
        fadeDuration={0}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.profileBg}
              activeOpacity={0.8}
              onPress={() => navigateTo('Profile')}
            >
              <Image
                source={{ uri: PROFILE_IMAGE }}
                style={styles.profilePhoto}
                fadeDuration={0}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.textWrapper}
              activeOpacity={0.8}
              onPress={() => navigateTo('Profile')}
            >
              <Text style={styles.name} numberOfLines={1}>
                {user?.name || 'Guest User'}
              </Text>

              <Text style={styles.email} numberOfLines={1}>
                {user?.email || 'guest@example.com'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={navigation.closeDrawer}
          >
            <CloseIcon width={24} height={24} />
          </TouchableOpacity>
        </View>
      </ImageBackground>
      {/* CONTENT */}
      <DrawerContentScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        removeClippedSubviews
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.itemsRow}>
          <View style={[styles.menuCard, styles.rewardsCard]}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              1,250
            </Text>

            <Text style={styles.cardText} numberOfLines={1}>
              Rewards Points
            </Text>
          </View>

          <View style={[styles.menuCard, styles.toursCard]}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              24
            </Text>

            <Text style={styles.cardText} numberOfLines={1}>
              Places Visited
            </Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <TabsButtons
            title="Rewards"
            Icon={RewardsIcon}
            onPress={() => navigateTo('Rewards')}
          />

          <TabsButtons
            title="Profile"
            Icon={BottomProfileIcon}
            onPress={() => navigateTo('Profile')}
          />

          <View style={styles.divider} />

          <TabsButtons
            title="Help & Support"
            Icon={HelpIcon}
            onPress={() =>
              navigateTo('Tabs', {
                screen: 'MyTour',
              })
            }
          />

          <TabsButtons
            title="Terms & Conditions"
            Icon={TermsIcon}
            onPress={() =>
              navigateTo('Tabs', {
                screen: 'MyTour',
              })
            }
          />
        </View>
      </DrawerContentScrollView>

      {/* LOGOUT */}
      <TouchableOpacity
        style={[
          styles.logoutBtn,
          { marginBottom: Math.max(insets.bottom + 12, 24) },
        ]}
        activeOpacity={0.8}
        onPress={handleLogout}
      >
        <LogoutIcon width={36} height={36} />

        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(CustomDrawer);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },

  topHeader: {
    height: 120,
    justifyContent: 'flex-end',
  },

  headerImage: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  profileBg: {
    width: 47,
    height: 47,
    borderRadius: 24,
    backgroundColor: COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
  },

  profilePhoto: {
    width: 41,
    height: 41,
    borderRadius: 21,
  },

  textWrapper: {
    marginLeft: 12,
    marginRight: 8,
    minWidth: 0,
    flexShrink: 1,
  },

  name: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.WHITE,
  },

  email: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    color: COLORS.WHITE,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },

  scrollContent: {
    paddingTop: 10,
    paddingBottom: 20,
    flexGrow: 1,
  },

  itemsRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 20,
    gap: 10,
  },

  menuCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    height: 74,
  },

  rewardsCard: {
    backgroundColor: '#EFD05130',
  },

  toursCard: {
    backgroundColor: '#FADBD1',
  },

  menuContainer: {
    paddingHorizontal: 8,
    gap: 22,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.BORDER,
  },

  logoutBtn: {
    backgroundColor: COLORS.LOUGOUT_COLOR,
    marginHorizontal: 19,
    padding: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  logoutText: {
    color: COLORS.LOGOUT_TEXT,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },

  cardTitle: {
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Bold,
  },

  cardText: {
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    marginTop: 6,
  },
});
