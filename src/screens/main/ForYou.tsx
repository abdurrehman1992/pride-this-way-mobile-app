import React, { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import { MapIconMain } from '../../constants/icons';
import TopHeader from '../../components/Home/TopHeader';
import LocationModal from '../../components/modals/LocationModal';
import PreferenceModal from '../../components/modals/PreferenceModal';
import ForYouContent from '../../components/Home/ForYouContent';
import { fetchTourTags, FirebaseTag } from '../../services/myTourService';

const ForYou = () => {
  const [isPreferencesSet, setIsPreferencesSet] = useState(false);
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [flexToggle, setFlexToggle] = useState(false);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [modals, setModals] = useState({
    location: false,
    preference: false,
  });

  useEffect(() => {
    fetchTourTags()
      .then((tags: FirebaseTag[]) => {
        const names = tags.map((t) => t.name).filter(Boolean);
        if (names.length > 0) setTagOptions(names);
      })
      .catch((err) => {
        console.warn('[ForYou] failed to fetch tags:', err);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsPreferencesSet(false);
      setSelectedLocation('');
      setSelectedPrefs([]);
      setModals({ location: false, preference: false });
    }, []),
  );

  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setFlexToggle(false);
    });

    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setFlexToggle(true);
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  const openModal = (key: keyof typeof modals) =>
    setModals((prev) => ({ ...prev, [key]: true }));

  const closeAllModals = () =>
    setModals({ location: false, preference: false });

  const goNextModal = (from: keyof typeof modals, to: keyof typeof modals) => {
    setModals((prev) => ({ ...prev, [from]: false, [to]: true }));
  };

  const handleCancel = () => {
    closeAllModals();
    setSelectedPrefs([]);
    setSelectedLocation('');
    setIsPreferencesSet(false);
  };

  const handleLocationNext = (location: string) => {
    setSelectedLocation(location);
    goNextModal('location', 'preference');
  };

  const togglePreference = (item: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(item)
        ? prev.filter((preference) => preference !== item)
        : [...prev, item]
    );
  };

  const handleApply = () => {
    closeAllModals();
    setIsPreferencesSet(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      style={
        flexToggle
          ? [styles.container, styles.containerGrow]
          : [styles.container, styles.containerFlex]
      }
      enabled={!flexToggle}
    >
      <TopHeader title="Recommendations" />

      {isPreferencesSet ? (
        <ForYouContent
          location={selectedLocation}
          prefs={selectedPrefs}
          onReset={handleCancel}
        />
      ) : (
        <View style={styles.centerContainer}>
          <View style={styles.emptyStateWrapper}>
            <MapIconMain width={190} height={121} />
            <Text style={styles.title}>Explore What’s Around You</Text>
            <Text style={styles.description}>
              Add your location and select your preferences to discover
              personalized places, events, and recommendations tailored just for
              you.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => openModal('location')}
            >
              <Text style={styles.primaryButtonText}>Add Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <LocationModal
        visible={modals.location}
        showActions
        primaryLabel="Apply"
        secondaryLabel="Cancel"
        onClose={handleCancel}
        onSecondaryPress={handleCancel}
        onNext={handleLocationNext}
      />

      <PreferenceModal
        visible={modals.preference}
        selectedPrefs={selectedPrefs}
        togglePreference={togglePreference}
        clearAll={() => setSelectedPrefs([])}
        onClose={handleCancel}
        onPrimary={handleApply}
        onSecondary={handleCancel}
        mode="forYou"
        showTwoButtons
        preferences={tagOptions.length > 0 ? tagOptions : undefined}
      />
    </KeyboardAvoidingView>
  );
};

export default ForYou;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9F9F9',
  },
  containerGrow: {
    flexGrow: 1,
  },
  containerFlex: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 30,
    fontSize: FONT_SIZE.LARGE_TEXT,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    textAlign: 'center',
  },
  description: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: FONT_SIZE.TEXT,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    width: 327,
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: 28,
    backgroundColor: COLORS.BUTTON_COLOR,
    height: 50,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 52,
  },
  primaryButtonText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
});
