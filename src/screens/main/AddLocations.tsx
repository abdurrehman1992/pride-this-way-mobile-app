import ActionTouchable from '../../components/common/ActionTouchable';
import { canAddTourLocation } from '../../utils/tourLocationValidation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
  const [pendingPlaceIds, setPendingPlaceIds] = useState<string[]>([]);
  const isMultiSelect = fromScreen === 'TourSuggestion';
  const existingPlaceIdSet = useMemo(
    () => new Set([...existingPlaceIds, ...extraPlaceIds]),
    [existingPlaceIds, extraPlaceIds]
  );
  const pendingPlaceIdSet = useMemo(
    () => new Set(pendingPlaceIds),
    [pendingPlaceIds]
  );

  const togglePendingPlace = (placeId: string) => {
    setPendingPlaceIds((current) =>
      current.includes(placeId)
        ? current.filter((id) => id !== placeId)
        : [...current, placeId]
    );
  };

  const addSelectedLocations = async () => {
    if (pendingPlaceIds.length === 0) return;
    if (!(await canAddTourLocation())) return;

    const selectedIds = [...pendingPlaceIds];
    const addedCount = selectedIds.length;
    navigation.goBack();

    setTimeout(() => {
      navigation.navigate({
        name: 'TourSuggestion',
        params: {
          addedPlaceIds: selectedIds,
          timestamp: Date.now(),
        },
        merge: true,
      });
      showSuccess(
        addedCount === 1 ? 'Location added' : 'Locations added',
        `${addedCount} ${addedCount === 1 ? 'location has' : 'locations have'} been added to your tour.`
      );
    }, 100);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timeout = setTimeout(async () => {
      try {
        if (!(await canAddTourLocation()) || cancelled) return;
        // Keep recommendations scoped to the selected tour city.
        const result = await fetchPlacesForLocation(cityLabel, searchText, { cityOnly: true });
        if (!cancelled) setPlaces(result);
      } catch {
        if (!cancelled) showInfo('Unable to load locations', 'Please check your internet connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [cityLabel, searchText]);

  const title = useMemo(() => {
    if (!cityLabel) {
      return 'Recommendations';
    }

    return `Recommendations in ${cityLabel}`;
  }, [cityLabel]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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

            <Text style={styles.title}>{title}</Text>
            {isMultiSelect ? (
              <Text style={styles.selectionHint}>
                Select as many locations as you want, then add them together.
              </Text>
            ) : null}
          </View>

          {isMultiSelect ? (
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionCount}>
                {pendingPlaceIds.length} selected
              </Text>
            </View>
          ) : null}

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
              contentContainerStyle={[
                styles.listContainer,
                isMultiSelect && styles.multiSelectListContainer,
              ]}
              style={styles.list}
              renderItem={({ item }) => {
                const isAlreadyAdded = existingPlaceIdSet.has(item.id);
                const isPending = pendingPlaceIdSet.has(item.id);

                return (
                  <View style={isAlreadyAdded || isPending ? styles.selectedCard : undefined}>
                    <PlacesArroundCard
                      id={item.id}
                      title={item.name}
                      description={item.description || item.address || 'Location'}
                      rating={String(item.rating || 0)}
                      image={item.imageUrl || 'https://picsum.photos/200'}
                      location={[item.city_name, item.country].filter(Boolean).join(', ')}
                      category="Place"
                      onPress={async () => {
                        if (!(await canAddTourLocation())) return;
                        if (isAlreadyAdded) {
                          showInfo(
                            'Location already added',
                            `${item.name} is already in your tour.`
                          );
                          return;
                        }

                        if (isMultiSelect) {
                          togglePendingPlace(item.id);
                          return;
                        }

                        showSuccess(
                          'Location added',
                          `${item.name} has been added to your tour.`
                        );
                        navigation.goBack();

                        setTimeout(() => {
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
                    />
                    {isAlreadyAdded || isPending ? (
                      <View style={styles.selectedBadge} pointerEvents="none">
                        <Text style={styles.selectedBadgeText}>
                          {isAlreadyAdded ? 'Already added' : 'Selected'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No places found for this search.</Text>
                </View>
              }
            />
          )}

          {isMultiSelect ? (
            <View style={styles.selectionFooter}>
              <ActionTouchable
                activeOpacity={0.85}
                disabled={pendingPlaceIds.length === 0}
                onPress={addSelectedLocations}
                style={[
                  styles.addSelectedButton,
                  pendingPlaceIds.length === 0 && styles.addSelectedButtonDisabled,
                ]}
              >
                <Text style={styles.addSelectedButtonText}>
                  {pendingPlaceIds.length === 1
                    ? 'Add 1 Location'
                    : `Add ${pendingPlaceIds.length} Locations`}
                </Text>
              </ActionTouchable>
            </View>
          ) : null}
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
  list: {
    flex: 1,
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
  title: {
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
  },
  selectionHint: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    marginTop: 4,
  },
  listContainer: {
    paddingTop: 16,
    paddingBottom: 10,
    gap: 14,
  },
  multiSelectListContainer: {
    // Reserve the fixed action footer plus the Android gesture area so the
    // final recommendation can scroll fully above the Add button.
    paddingBottom: 72,
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
  selectionFooter: {
    backgroundColor: COLORS.SCREENS_BG,
    paddingTop: 8,
    paddingBottom: 12,
  },
  selectionSummary: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#E7F2FC',
  },
  selectionCount: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.PILL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  addSelectedButton: {
    alignItems: 'center',
    backgroundColor: COLORS.BUTTON_COLOR,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
  },
  addSelectedButtonDisabled: {
    backgroundColor: COLORS.BUTTON_DISABLED,
  },
  addSelectedButtonText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
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
