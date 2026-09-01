import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import ForgeTopHeader from '../../components/common/ForgeTopHeader';
import CustomSearchInput from '../../components/Home/CustomSearchInput';
import PlacesArroundCard from '../../components/Home/PlacesArroundCard';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import { fetchPlacesForLocation, FirebasePlace } from '../../services/myTourService';
import { showInfo, showSuccess } from '../../components/common/AppToast';

type RouteParams = {
  routeId?: string;
  cityLabel?: string;
  fromScreen?: 'MyTour' | 'MyTourStart' | 'TourSuggestion';
  routeName?: string;
  tourName?: string;
  extraPlaceIds?: string[];
  existingPlaceIds?: string[];
  removedPlaceIds?: string[];
  tourId?: string;
  isEdited?: boolean;
};

const AddLocations = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {
    routeId,
    cityLabel = '',
    fromScreen = 'MyTour',
    routeName,
    tourName,
    extraPlaceIds = [],
    existingPlaceIds = [],
    removedPlaceIds = [],
    tourId,
  } = (route.params || {}) as RouteParams;

  const [searchText, setSearchText] = useState('');
  const [places, setPlaces] = useState<FirebasePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [cityOnly, setCityOnly] = useState(false);
  const selectedPlaceIds = useMemo(
    () => new Set([...existingPlaceIds, ...extraPlaceIds]),
    [existingPlaceIds, extraPlaceIds]
  );

  useEffect(() => {
    setLoading(true);

    const timeout = setTimeout(() => {
      fetchPlacesForLocation(cityLabel, searchText, { cityOnly })
        .then(setPlaces)
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timeout);
  }, [cityLabel, cityOnly, searchText]);

  const title = useMemo(() => {
    if (!cityLabel) {
      return 'Recommendations';
    }

    return `Recommendations in ${cityLabel}`;
  }, [cityLabel]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.content}>
          <ForgeTopHeader title="Add Locations" />
          <View style={styles.searchSection}>
            <CustomSearchInput
              value={searchText}
              onChangeText={(text: string) => setSearchText(text)}
              onClear={() => setSearchText('')}
            />

            {cityLabel ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{cityLabel}</Text>
              </View>
            ) : null}

            <View style={[styles.pill, styles.filterModePill]}>
              <Text style={styles.pillText}>
                {cityOnly ? 'Selected City Only' : 'All Places'}
              </Text>
            </View>

            <Text style={styles.title}>{title}</Text>
          </View>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
            </View>
          ) : (
            <FlatList
              data={places}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => {
                const isAlreadyAdded = selectedPlaceIds.has(item.id);

                return (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={isAlreadyAdded && styles.selectedCard}
                    onPress={() => {
                      if (isAlreadyAdded) {
                        showInfo(
                          'Location already added',
                          `${item.name} is already in your tour.`
                        );
                        return;
                      }

                      showSuccess(
                        'Location added',
                        `${item.name} has been added to your tour.`
                      );
                      navigation.goBack();

                    setTimeout(() => {
                      if (fromScreen === 'TourSuggestion') {
                        navigation.navigate({
                          name: 'TourSuggestion',
                          params: {
                            addedPlaceId: item.id,
                            timestamp: Date.now(),
                          },
                          merge: true,
                        });
                        return;
                      }

                      if (fromScreen === 'MyTourStart') {
                        navigation.navigate('MyTourStart', {
                          routeId,
                          routeName,
                          tourName,
                          cityLabel,
                          addedPlaceId: item.id,
                          extraPlaceIds,
                          removedPlaceIds,
                          tourId,
                          isEdited: true,
                        });
                        return;
                      }

                      navigation.navigate('MyTour', {
                        routeId,
                        addedPlaceId: item.id,
                        timestamp: Date.now(),
                      });
                    }, 100);
                    }}
                  >
                    <PlacesArroundCard
                      id={item.id}
                      title={item.name}
                      description={item.description || item.address || 'Location'}
                      rating={String(item.rating || 0)}
                      image={item.imageUrl || 'https://picsum.photos/200'}
                      location={[item.city_name, item.country].filter(Boolean).join(', ')}
                      category="Place"
                    />
                    {isAlreadyAdded ? (
                      <View style={styles.selectedBadge} pointerEvents="none">
                        <Text style={styles.selectedBadgeText}>Already added</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No places found for this search.</Text>
                </View>
              }
            />
          )}
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
  filterBtn: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.BUTTON_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  pillText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  filterModePill: {
    marginTop: -2,
  },
  title: {
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
  },
  listContainer: {
    paddingTop: 16,
    paddingBottom: 10,
    gap: 14,
  },
  selectedCard: {
    borderWidth: 1.5,
    borderColor: COLORS.BUTTON_COLOR,
    borderRadius: 14,
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 46,
    backgroundColor: COLORS.BUTTON_COLOR,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.PILL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
});
