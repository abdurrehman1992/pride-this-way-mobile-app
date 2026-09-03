import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
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
import {
  getRecommendations,
  resolvePlaceImageUrl,
  AIRecommendations,
  AIPlace,
  getLastQuotaExceededTimestamp,
  clearLastQuotaExceeded,
} from '../../services/aiService';
import { fetchTourTags } from '../../services/myTourService';
import { buildRecommendationQueryKey } from '../../utils/recommendationQuery';

type Props = {
  location: string;
  prefs: string[];
  onReset?: () => void;
};

const ForYouContent: React.FC<Props> = ({ location, prefs, onReset }) => {
  const navigation = useNavigation<any>();
  const [showAll, setShowAll] = useState(false);
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(
    location || null,
  );
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>(prefs);
  const [modals, setModals] = useState({
    location: false,
    preference: false,
  });
  const prevPrefsRef = useRef<string[] | null>(null);
  const [data, setData] = useState<AIRecommendations | null>(null);
  const [allPreferences, setAllPreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState(false);
  const lastRequestKeyRef = useRef<string | null>(null);

  const hasFilters = selectedLocation || selectedPrefs.length > 0;

  const loadRecommendations = async (loc: string, p: string[], showLoading = true) => {
    if (!loc) return;
    const nextKey = buildRecommendationQueryKey(loc, p);
    if (nextKey && lastRequestKeyRef.current === nextKey) {
      return;
    }
    lastRequestKeyRef.current = nextKey || null;

    if (showLoading) {
      setLoading(true);
    }
    setError(false);
    setQuotaWarning(false);
    try {
      const result = await getRecommendations(loc, p);
      const placesAround = await Promise.all(
        (result.placesAroundYou ?? []).map(async item => {
          const imageUrl = await resolvePlaceImageUrl(item.title, item.imageKeyword, item.location || loc, item.imageUrl);
          const wikimediaFallback = await resolvePlaceImageUrl(
            item.title,
            item.imageKeyword,
            item.location || loc,
            item.imageUrl,
            true,
          );
          const fallbackImageUrl = wikimediaFallback !== imageUrl
            ? wikimediaFallback
            : item.imageUrl !== imageUrl ? item.imageUrl : undefined;
          return {
            ...item,
            imageUrl,
            fallbackImageUrl,
            gallery: [imageUrl, fallbackImageUrl].filter(Boolean) as string[],
          };
        }),
      );
      const recommended = await Promise.all(
        (result.recommendedForYou ?? []).map(async item => {
          const imageUrl = await resolvePlaceImageUrl(item.title, item.imageKeyword, item.location || loc, item.imageUrl);
          const wikimediaFallback = await resolvePlaceImageUrl(
            item.title,
            item.imageKeyword,
            item.location || loc,
            item.imageUrl,
            true,
          );
          const fallbackImageUrl = wikimediaFallback !== imageUrl
            ? wikimediaFallback
            : item.imageUrl !== imageUrl ? item.imageUrl : undefined;
          return {
            ...item,
            imageUrl,
            fallbackImageUrl,
            gallery: [imageUrl, fallbackImageUrl].filter(Boolean) as string[],
          };
        }),
      );

      setData({
        ...result,
        placesAroundYou: placesAround,
        recommendedForYou: recommended,
      });
      // If the AI call failed due to quota, the service sets a flag we can inspect
      try {
        const ts = getLastQuotaExceededTimestamp();
        if (ts && ts > 0) {
          setQuotaWarning(true);
          // clear the flag so subsequent calls are fresh
          clearLastQuotaExceeded();
        }
      } catch (_e) {
        // ignore
      }
    } catch (err) {
      console.warn('[ForYouContent] unexpected error', err);
      setError(true);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setSelectedLocation(location || null);
    setSelectedPrefs(prefs);
    lastRequestKeyRef.current = null;
  }, [location, prefs]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const tags = await fetchTourTags();
        if (!mounted) return;
        const names = (tags || []).map(t => t.name).filter(Boolean);
        setAllPreferences(names.length ? names : ['Food', 'Adventure', 'History', 'Shopping']);
      } catch (err) {
        // fallback to defaults
        setAllPreferences(['Food', 'Adventure', 'History', 'Shopping']);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    const queryPrefs = [...selectedPrefs].slice().sort();
    const nextKey = buildRecommendationQueryKey(selectedLocation, queryPrefs);
    if (lastRequestKeyRef.current === nextKey) return;

    const timer = setTimeout(() => {
      loadRecommendations(selectedLocation, queryPrefs, true);
    }, 220);

    return () => clearTimeout(timer);
  }, [selectedLocation, selectedPrefs]);

  const openLocationModal = () => {
    setModals({ location: true, preference: false });
  };

  const closeModals = () => {
    // If preference modal was open and user cancels/closes it, restore previous prefs
    if (modals.preference && prevPrefsRef.current) {
      setSelectedPrefs(prevPrefsRef.current);
    }
    prevPrefsRef.current = null;
    setModals({ location: false, preference: false });
  };

  const handleLocationNext = (loc: string) => {
    // snapshot current prefs so Cancel can restore them
    prevPrefsRef.current = [...selectedPrefs];
    setSelectedLocation(loc);
    setModals({ location: false, preference: true });
  };

  const handleApplyPreferences = (newPrefs: string[]) => {
    const nextPrefs = Array.from(new Set(newPrefs));
    setSelectedPrefs(nextPrefs);
    prevPrefsRef.current = null;
    closeModals();
  };

  const resetFilters = () => {
    setSelectedLocation(null);
    setSelectedPrefs([]);
    setData(null);
    lastRequestKeyRef.current = null;
    if (onReset) onReset();
  };

  const togglePref = (item: string) => {
    setSelectedPrefs(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item],
    );
  };

  const placesAround = data?.placesAroundYou ?? [];
  const recommended = data?.recommendedForYou ?? [];

  const filteredPlaces = useMemo(() => {
    const q = searchText.toLowerCase();
    return placesAround.filter(item => item.title.toLowerCase().includes(q));
  }, [searchText, placesAround]);

  const filteredRecommended = useMemo(() => {
    const q = searchText.toLowerCase();
    return recommended.filter(item => item.title.toLowerCase().includes(q));
  }, [searchText, recommended]);

  const displayedData = showAll
    ? filteredRecommended
    : filteredRecommended.slice(0, 2);
  const displayedPlaces = showAllPlaces
    ? filteredPlaces
    : filteredPlaces.slice(0, 2);

  const renderRecommendedItem = ({ item }: { item: AIPlace }) => (
    <RecommendedForYou
      id={item.id}
      title={item.title}
      description={item.description}
      rating={item.rating}
      image={item.imageUrl}
      fallbackImage={item.fallbackImageUrl}
      category={item.category || 'Place'}
      originalPlace={(item as any).originalPlace}
      onPress={() =>
        navigation.navigate('RecommendationDetials', {
          item: {
            ...item,
            image: item.imageUrl,
          },
        })
      }
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={displayedData}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={renderRecommendedItem}
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
                    <TouchableOpacity onPress={() => {
                      setSelectedLocation(null);
                    }}>
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

            {loading && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
                <Text style={styles.loadingText}>
                  Finding the best spots for you…
                </Text>
              </View>
            )}

            {error && !loading && (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>Couldn’t load recommendations.</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() =>
                    loadRecommendations(selectedLocation || '', selectedPrefs)
                  }
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {quotaWarning && (
              <View style={styles.quotaBanner}>
                <Text style={styles.quotaText}>
                  AI recommendations currently unavailable — showing fallback suggestions.
                </Text>
              </View>
            )}

            {!loading && !error && (
              <>
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
                        image={item.imageUrl}
                        location={item.location || selectedLocation || 'Lahore, Pakistan'}
                        time={item.openText || 'Open today'}
                        category={item.category || 'Event'}
                        width={295}
                        onPress={() =>
                          navigation.navigate('RecommendationDetials', {
                            item: {
                              ...item,
                              image: item.imageUrl,
                              imageUrl: item.imageUrl,
                              location: item.location || selectedLocation || 'Lahore, Pakistan',
                              address: item.address || item.location || selectedLocation || 'Lahore, Pakistan',
                            },
                          })
                        }
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
                        {showAll ? 'Show Less' : 'See All'}
                      </Text>
                    </TouchableOpacity>

                  </View>
                </View>
              </>
            )}
          </>
        }
      />
      <LocationModal
        visible={modals.location}
        onClose={closeModals}
        onNext={handleLocationNext}
        searchValue={selectedLocation || ''}
        onSearchChange={(val: string) => setSelectedLocation(val)}
      />

      <PreferenceModal
        visible={modals.preference}
        selectedPrefs={selectedPrefs}
        togglePreference={togglePref}
        clearAll={() => setSelectedPrefs([])}
        onClose={closeModals}
        onPrimary={() => handleApplyPreferences(selectedPrefs)}
        onSecondary={closeModals}
        preferences={allPreferences}
        mode="forYou"
      />
    </View>
  );
};

export default ForYouContent;

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
    marginTop: 6,
    marginBottom: 8,
    alignItems: 'center',
    gap: 8,
  },

  chip: {
    flexDirection: 'row',
    backgroundColor: COLORS.BUTTON_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 32,
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
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    fontSize: FONT_SIZE.TEXT,
  },
  errorWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    fontSize: FONT_SIZE.TEXT,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    backgroundColor: COLORS.BUTTON_COLOR,
    borderRadius: 24,
  },
  retryText: {
    color: COLORS.WHITE,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    fontSize: FONT_SIZE.TEXT,
  },
  quotaBanner: {
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFF4E5',
  },
  quotaText: {
    color: '#663C00',
    fontFamily: FONT_FAMILY.InterTight_Regular,
    fontSize: FONT_SIZE.TEXT,
    textAlign: 'center',
  },
});
