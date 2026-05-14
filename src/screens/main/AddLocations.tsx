import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from 'react-native';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import ForgeTopHeader from '../../components/common/ForgeTopHeader';
import CustomSearchInput from '../../components/Home/CustomSearchInput';
import PlacesArroundCard from '../../components/Home/PlacesArroundCard';
import LocationModal from '../../components/modals/LocationModal';
import PreferenceModal from '../../components/modals/PreferenceModal';

import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import { FilterIcon } from '../../constants/images';

type RouteParams = {
  tourId?: number;
};

const locationsData = [
  {
    id: '1',
    title: 'Beach Party',
    description: 'Fun night at beach',
    rating: '4.5',
    image: 'https://picsum.photos/200',
    category: 'Event',
    location: 'California',
  },
  {
    id: '2',
    title: 'Music Night',
    description: 'Live band show',
    rating: '4.7',
    image: 'https://picsum.photos/201',
    category: 'Music',
    location: 'New York',
  },
  {
    id: '3',
    title: 'Food Festival',
    description: 'Street food event',
    rating: '4.8',
    image: 'https://picsum.photos/202',
    category: 'Food',
    location: 'California',
  },
  {
    id: '4',
    title: 'Mountain Adventure',
    description: 'Hiking & camping trip',
    rating: '4.9',
    image: 'https://picsum.photos/203',
    category: 'Adventure',
    location: 'Switzerland',
  },
  {
    id: '5',
    title: 'Mall Shopping Day',
    description: 'Brand shopping deals',
    rating: '4.3',
    image: 'https://picsum.photos/204',
    category: 'Shopping',
    location: 'Dubai',
  },
];

const AddLocations = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();

  const { tourId } = (route.params || {}) as RouteParams;

  const [searchText, setSearchText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
// Source - https://stackoverflow.com/a/79665003
// Posted by Iulian T, modified by community. See post 'Timeline' for change history
// Retrieved 2026-05-14, License - CC BY-SA 4.0

const [flexToggle, setFlexToggle] = useState(false);

  const [modals, setModals] = useState({
    location: false,
    preference: false,
  });
  
  // Source - https://stackoverflow.com/a/79665003
// Posted by Iulian T, modified by community. See post 'Timeline' for change history
// Retrieved 2026-05-14, License - CC BY-SA 4.0

useEffect(() => {
  const keyboardShowListener = Keyboard.addListener("keyboardDidShow", () => {
    setFlexToggle(false);
  });

  const keyboardHideListener = Keyboard.addListener("keyboardDidHide", () => {
    setFlexToggle(true);
  });

  return () => {
    keyboardShowListener.remove();
    keyboardHideListener.remove();
  };
}, []);


  const openLocationModal = () =>
    setModals({ location: true, preference: false });

  const closeModals = () => setModals({ location: false, preference: false });

  const handleLocationSelect = (locations: string[]) => {
    const primary = locations[0] ?? null;
    setSelectedLocation(primary);

    setModals({
      location: false,
      preference: true,
    });
  };

  const filteredData = useMemo(() => {
    return locationsData.filter(item => {
      const matchSearch =
        item.title.toLowerCase().includes(searchText.toLowerCase()) ||
        item.description.toLowerCase().includes(searchText.toLowerCase());

      const matchPrefs =
        selectedPrefs.length === 0 || selectedPrefs.includes(item.category);

      const matchLocation =
        !selectedLocation || item.location === selectedLocation;

      return matchSearch && matchPrefs && matchLocation;
    });
  }, [searchText, selectedPrefs, selectedLocation]);

  const togglePref = (item: string) => {
    setSelectedPrefs(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item],
    );
  };

  const removePref = (item: string) => {
    setSelectedPrefs(prev => prev.filter(i => i !== item));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      // Source - https://stackoverflow.com/a/79665003
// Posted by Iulian T, modified by community. See post 'Timeline' for change history
// Retrieved 2026-05-14, License - CC BY-SA 4.0

<KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
  style={
    flexToggle
      ? [{ flexGrow: 1 }, styles.container]
      : [{ flex: 1 }, styles.container]
  }
  enabled={!flexToggle}
>

        <View style={styles.content}>
          <ForgeTopHeader title="Add Locations" />
          <View style={styles.searchSection}>
            <CustomSearchInput
              value={searchText}
              onChangeText={(text: string) => setSearchText(text)}
              rightIcon={
                <TouchableOpacity onPress={openLocationModal}>
                  <Image source={FilterIcon} style={styles.filterIcon} />
                </TouchableOpacity>
              }
            />

            <View style={styles.pillWrapper}>
              {selectedLocation && (
                <View style={styles.pill}>
                  {/* <Text style={styles.pillText}>{selectedLocation}</Text> */}
                  <Text style={styles.pillText}>Picked Location</Text>

                  <TouchableOpacity onPress={() => setSelectedLocation(null)}>
                    <Text style={styles.remove}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedPrefs.map(item => (
                <View key={item} style={styles.pill}>
                  <Text style={styles.pillText}>{item}</Text>

                  <TouchableOpacity onPress={() => removePref(item)}>
                    <Text style={styles.remove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <Text style={styles.title}>Recommendations</Text>
          </View>

          <FlatList
            data={filteredData}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  navigation.goBack();

                  setTimeout(() => {
                    navigation.navigate('MyTour', {
                      selectedLocation: item.title,
                      tourId,
                      timestamp: Date.now(),
                    });
                  }, 100);
                }}
              >
                <PlacesArroundCard
                  id={item.id}
                  title={item.title}
                  description={item.description}
                  rating={item.rating}
                  image={item.image}
                />
              </TouchableOpacity>
            )}
          />

          <LocationModal
            visible={modals.location}
            onClose={closeModals}
            onNext={handleLocationSelect}
          />

          <PreferenceModal
            visible={modals.preference}
            selectedPrefs={selectedPrefs}
            togglePreference={togglePref}
            clearAll={() => setSelectedPrefs([])}
            onClose={closeModals}
            onPrimary={closeModals}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddLocations;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.SCREENS_BG,
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  content: {
    flex: 1,
    marginTop: 24,
    marginHorizontal: 24,

  },

  searchSection: {
    marginTop: 10,
  },

  filterIcon: {
    width: 20,
    height: 20,
  },

  title: {
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    // marginTop: 10,
  },

  listContainer: {
    paddingTop: 16,
    paddingBottom: 10,
    gap: 14,
  },

  pillWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // marginTop: 10,
    gap: 8,
  },

  pill: {
    flexDirection: 'row',
    backgroundColor: COLORS.BUTTON_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignItems: 'center',
    gap: 6,
  },

  pillText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.CARD_TEXT,
  },

  remove: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.CARD_TEXT,
  },
});
