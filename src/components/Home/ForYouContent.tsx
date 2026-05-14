import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import CustomSearchInput from './CustomSearchInput';
import PlacesArroundCard from '../../components/Home/PlacesArroundCard';
import RecommendedForYou from '../../components/Home/RecommendedForYou';
import LocationModal from '../../components/modals/LocationModal';
import PreferenceModal from '../../components/modals/PreferenceModal';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import { FilterIcon } from '../../constants/images';

const horizontalData = [
  {
    id: 'place_1',
    title: 'Beach Party',
    description: 'Fun night at beach',
    rating: '4.5',
    image: 'https://picsum.photos/200',
    category: 'Event',
  },
  {
    id: 'place_2',
    title: 'Music Night',
    description: 'Live band show',
    rating: '4.7',
    image: 'https://picsum.photos/201',
    category: 'Music',
  },
  {
    id: 'place_3',
    title: 'Food Festival',
    description: 'Street food event',
    rating: '4.8',
    image: 'https://picsum.photos/202',
    category: 'Food',
  },
];

const recommendedData = [
  {
    id: 'rec_1',
    title: 'Skyline Rooftop Dining',
    description: 'Enjoy food with stunning city views',
    rating: '4.7',
    image: 'https://picsum.photos/210',
    category: 'Restaurant',
  },
  {
    id: 'rec_2',
    title: 'Jazz Night',
    description: 'Live jazz experience',
    rating: '4.6',
    image: 'https://picsum.photos/211',
    category: 'Music',
  },
  {
    id: 'rec_3',
    title: 'Mountain Hiking',
    description: 'Adventure in the hills',
    rating: '4.8',
    image: 'https://picsum.photos/212',
    category: 'Adventure',
  },
  {
    id: 'rec_4',
    title: 'City Museum Tour',
    description: 'Explore history & culture',
    rating: '4.5',
    image: 'https://picsum.photos/213',
    category: 'History',
  },
  {
    id: 'rec_5',
    title: 'Shopping Mall',
    description: 'Best brands & deals',
    rating: '4.4',
    image: 'https://picsum.photos/214',
    category: 'Shopping',
  },
];

const Home: React.FC = () => {
  const navigation = useNavigation<any>();
  const [showAll, setShowAll] = useState(false);
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [modals, setModals] = useState({
    location: false,
    preference: false,
  });
  const hasFilters = selectedLocation || selectedPrefs.length > 0;
  const openLocationModal = () => {
    setModals({ location: true, preference: false });
  };

  const closeModals = () => {
    setModals({ location: false, preference: false });
  };

  const handleLocationSelect = (locations: string[]) => {
    const primary = locations[0] ?? null;
    setSelectedLocation(primary);

    setModals({
      location: false,
      preference: true,
    });
  };

  const handleApplyPreferences = (prefs: string[]) => {
    setSelectedPrefs(prefs);
    closeModals();
  };

  const resetFilters = () => {
    setSelectedLocation(null);
    setSelectedPrefs([]);
  };

  const togglePref = (item: string) => {
    setSelectedPrefs(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item],
    );
  };
  const filteredPlaces = useMemo(() => {
    return horizontalData.filter(item => {
      const matchSearch = item.title
        .toLowerCase()
        .includes(searchText.toLowerCase());

      const matchLocation =
        !selectedLocation || item.title.includes(selectedLocation);

      return matchSearch && matchLocation;
    });
  }, [searchText, selectedLocation]);

  const filteredRecommended = useMemo(() => {
    return recommendedData.filter(item => {
      const matchPrefs =
        selectedPrefs.length === 0 || selectedPrefs.includes(item.category);

      const matchSearch = item.title
        .toLowerCase()
        .includes(searchText.toLowerCase());

      return matchPrefs && matchSearch;
    });
  }, [searchText, selectedPrefs]);

  const displayedData = showAll
    ? filteredRecommended
    : filteredRecommended.slice(0, 2);
  const displayedPlaces = showAllPlaces
    ? filteredPlaces
    : filteredPlaces.slice(0, 2);

  return (
    <View style={styles.container}>
      <FlatList
        data={displayedData}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RecommendedForYou
            id={item.id}
            title={item.title}
            description={item.description}
            rating={item.rating}
            image={item.image}
            onPress={() =>
              navigation.navigate('RecommendationDetials', { item })
            }
          />
        )}
        ListHeaderComponent={
          <>
            <View style={styles.search}>
              <CustomSearchInput
                value={searchText}
                onChangeText={(text: string) => setSearchText(text)}
                rightIcon={
                  <TouchableOpacity onPress={openLocationModal}>
                    <Image source={FilterIcon} style={styles.filterIcon} />
                  </TouchableOpacity>
                }
              />
            </View>
            {hasFilters && (
              <View style={styles.filterRow}>
                {selectedLocation && (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{selectedLocation}</Text>
                    <TouchableOpacity onPress={() => setSelectedLocation(null)}>
                      <Text style={styles.remove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedPrefs.map(item => (
                  <View key={item} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        setSelectedPrefs(prev => prev.filter(i => i !== item))
                      }
                    >
                      <Text style={styles.remove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity onPress={resetFilters}>
                  <Text style={styles.reset}>Reset</Text>
                </TouchableOpacity>
              </View>
            )}

            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText} numberOfLines={2}>
                  Places Around You
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAllPlaces(!showAllPlaces)}
                  style={styles.headerAction}
                >
                  <Text style={styles.seeAllText}>
                    {showAllPlaces ? 'Show Less' : 'See All'}
                  </Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={displayedPlaces}
                horizontal
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => (
                  <PlacesArroundCard
                    id={item.id}
                    title={item.title}
                    description={item.description}
                    rating={item.rating}
                    image={item.image}
                    width={295}
                  />
                )}
              />
            </View>
            <View style={styles.recommendedSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText} numberOfLines={2}>
                  Recommended For You
                </Text>

                <TouchableOpacity
                  onPress={() => setShowAll(!showAll)}
                  style={styles.headerAction}
                >
                  <Text style={[styles.seeAllText, styles.recommendedAction]}>
                    {showAll ? 'Show Less' : 'Show All'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
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
        onPrimary={() => handleApplyPreferences(selectedPrefs)}
      />
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 24,
    marginBottom: 22,
  },

  sectionHeaderText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 18,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
  },

  headerAction: {
    flexShrink: 0,
    minHeight: 28,
    justifyContent: 'center',
  },

  seeAllText: {
    fontSize: FONT_SIZE.TEXT,
    color: COLORS.BUTTON_COLOR,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },

  recommendedAction: {
    color: '#EA673F',
  },

  recommendedSection: {
    marginTop: 30,
  },

  filterIcon: {
    width: 20,
    height: 20,
  },

  listContainer: {
    paddingHorizontal: 24,
    gap: 14,
  },
  search: {
    marginHorizontal: 24,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 24,
    marginTop: 10,
    alignItems: 'center',
    gap: 8,
  },

  chip: {
    flexDirection: 'row',
    backgroundColor: COLORS.BUTTON_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignItems: 'center',
    gap: 6,
  },

  chipText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },

  remove: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.CARD_TEXT,
  },

  reset: {
    marginLeft: 10,
    color: COLORS.CLEAR_ALL,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
});
