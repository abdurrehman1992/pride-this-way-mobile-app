import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  CreatedTourLocationIcon,
  EarnedPointIcon,
  HeartIcon,
  IconDelete,
  IconPlus,
  IconUp,
  MapIconMain,
  RedHeartIcon,
  TourDateIcon,
  TourLocationIcon,
} from '../../constants/icons';
import TopHeader from '../../components/Home/TopHeader';
import CustomButton from '../../components/common/CustomButton';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import LocationModal from '../../components/modals/LocationModal';
import PreferenceModal from '../../components/modals/PreferenceModal';
import NameTourModal from '../../components/modals/NameTourModal';
import { MyTourStackParamList } from '../../types/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showInfo } from '../../components/common/AppToast';
import {
  fetchUserTours,
  fetchPlacesByIds,
  fetchRecommendedRoutes,
  fetchRouteDetails,
  fetchTourTags,
  FirebasePlace,
  FirebaseTag,
  RecommendedRoute,
  SavedTour,
  searchLocationSuggestions,
} from '../../services/myTourService';
import { useSelector } from 'react-redux';
import { RootState } from '../../Redux/store';
import { useFavorites } from '../../context/FavoritesContext';

type NavigationProp = NativeStackNavigationProp<MyTourStackParamList, 'AddLocations'>;

type RouteCardState = RecommendedRoute & {
  cardId: string;
  isOpen: boolean;
  displayName: string;
  cityLabel: string;
  extraPlaces: FirebasePlace[];
  removedPlaceIds: string[];
  tourId?: string;
  status?: string;
  isSavedTour?: boolean;
};

type TourFilter = 'All' | 'Scheduled' | 'Favourite' | 'Completed';

const MyTour = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<NavigationProp>();
  const bottomHeight = useBottomTabBarHeight();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const [modals, setModals] = useState({
    location: false,
    preference: false,
    name: false,
  });
  const [tags, setTags] = useState<FirebaseTag[]>([]);
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [tourName, setTourName] = useState('');
  const [routeCards, setRouteCards] = useState<RouteCardState[]>([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [savedTourCards, setSavedTourCards] = useState<RouteCardState[]>([]);
  const [activeFilter, setActiveFilter] = useState<TourFilter>('All');
  const addedRouteId = route.params?.routeId;
  const addedPlaceId = route.params?.addedPlaceId;

  const tagNames = useMemo(() => tags.map((tag) => tag.name), [tags]);
  const selectedTagIds = useMemo(
    () =>
      tags
        .filter((tag) => selectedPrefs.includes(tag.name))
        .map((tag) => tag.id),
    [selectedPrefs, tags]
  );

  const openModal = (key: keyof typeof modals) =>
    setModals((prev) => ({
      ...prev,
      [key]: true,
    }));

  const closeModal = (key: keyof typeof modals) =>
    setModals((prev) => ({
      ...prev,
      [key]: false,
    }));

  const togglePreference = useCallback((item: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }, []);

  useEffect(() => {
    fetchTourTags().then(setTags).catch(() => setTags([]));
  }, []);

  useEffect(() => {
    if (!userId) {
      setSavedTourCards([]);
      return;
    }

    let isMounted = true;

    const loadSavedTours = async () => {
      try {
        const tours = await fetchUserTours(userId);
        const cards = await Promise.all(
          tours.map(async (tour: SavedTour) => {
            const [places, details] = await Promise.all([
              fetchPlacesByIds(tour.all_places.map((item) => item.place_id)),
              fetchRouteDetails({ routeId: tour.route_id, userId }),
            ]);

            const extraPlaces = places.filter((place) =>
              tour.all_places.some(
                (item) => item.place_id === place.id && item.addedByUser
              )
            );

            return {
              ...details,
              cardId: `saved-${tour.id}`,
              isOpen: true,
              displayName: tour.title,
              cityLabel:
                [tour.city_name, tour.country].filter(Boolean).join(', ') ||
                [details.route.city_name, details.route.country].filter(Boolean).join(', '),
              extraPlaces,
              removedPlaceIds: [],
              tourId: tour.id,
              status: tour.status,
              isSavedTour: true,
              places,
            } satisfies RouteCardState;
          })
        );

        if (isMounted) {
          setSavedTourCards(cards);
        }
      } catch {
        if (isMounted) {
          setSavedTourCards([]);
        }
      }
    };

    loadSavedTours();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!addedRouteId || !addedPlaceId) {
      return;
    }

    fetchPlacesByIds([addedPlaceId]).then((places) => {
      const addedPlace = places[0];

      if (!addedPlace) {
        return;
      }

      setRouteCards((prev) =>
        prev.map((item) => {
          if (item.route.id !== addedRouteId) {
            return item;
          }

          if (
            item.places.some((place) => place.id === addedPlace.id) ||
            item.extraPlaces.some((place) => place.id === addedPlace.id)
          ) {
            showInfo('Location already exists in this route');
            return item;
          }

          return {
            ...item,
            extraPlaces: [...item.extraPlaces, addedPlace],
            isOpen: true,
          };
        })
      );
    });
  }, [addedPlaceId, addedRouteId, route.params?.timestamp]);

  useEffect(() => {
    if (!modals.location) {
      return;
    }

    if (locationSearch.trim().length < 2) {
      setLocationSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);

    const timeout = setTimeout(() => {
      searchLocationSuggestions(locationSearch)
        .then((results) => {
          setLocationSuggestions(results.map((item) => item.label));
        })
        .finally(() => setLoadingSuggestions(false));
    }, 350);

    return () => clearTimeout(timeout);
  }, [locationSearch, modals.location]);

  const clearFlow = () => {
    setSelectedPrefs([]);
    setTourName('');
    setLocationSearch('');
    setSelectedLocation('');
    setLocationSuggestions([]);
  };

  const handleConfirmTour = async () => {
    setLoadingRoutes(true);

    try {
      const recommendations = await fetchRecommendedRoutes({
        locationLabel: selectedLocation || locationSearch,
        selectedTagIds,
        userId,
      });

      setRouteCards(
        recommendations.map((item) => ({
          ...item,
          cardId: `route-${item.route.id}`,
          isOpen: true,
          displayName: tourName.trim() || item.route.name,
          cityLabel:
            [item.route.city_name, item.route.country].filter(Boolean).join(', ') ||
            selectedLocation ||
            locationSearch,
          extraPlaces: [],
          removedPlaceIds: [],
          status: item.route.isScheduled ? 'scheduled' : 'active',
          isSavedTour: false,
        }))
      );
      closeModal('name');
      clearFlow();
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleOpenNameModal = async () => {
    setLoadingRoutes(true);

    try {
      const recommendations = await fetchRecommendedRoutes({
        locationLabel: selectedLocation || locationSearch,
        selectedTagIds,
        userId,
      });

      const suggestedName = recommendations[0]?.route?.name?.trim();
      setTourName(suggestedName || '');
      closeModal('preference');
      openModal('name');
    } finally {
      setLoadingRoutes(false);
    }
  };

  const toggleTour = (routeId: string) => {
    setRouteCards((prev) =>
      prev.map((routeCard) =>
        routeCard.cardId === routeId
          ? {
              ...routeCard,
              isOpen: !routeCard.isOpen,
            }
          : routeCard
      )
    );
    setSavedTourCards((prev) =>
      prev.map((routeCard) =>
        routeCard.cardId === routeId
          ? {
              ...routeCard,
              isOpen: !routeCard.isOpen,
            }
          : routeCard
      )
    );
  };

  const deleteTour = (routeId: string) => {
    setRouteCards((prev) => prev.filter((routeCard) => routeCard.cardId !== routeId));
    setSavedTourCards((prev) => prev.filter((routeCard) => routeCard.cardId !== routeId));
  };

  const handleStartTour = (tour: RouteCardState) => {
    navigation.navigate('MyTourStart', {
      routeId: tour.route.id,
      routeName: tour.displayName,
      tourName: tour.displayName,
      cityLabel: tour.cityLabel,
      selectedTagIds,
      extraPlaceIds: tour.extraPlaces.map((place) => place.id),
      removedPlaceIds: tour.removedPlaceIds,
      tourId: tour.tourId,
      isEdited:
        Boolean(tour.isSavedTour) ||
        tour.extraPlaces.length > 0 ||
        tour.removedPlaceIds.length > 0,
    });
  };

  const handleToggleFavorite = async (tour: RouteCardState) => {
    const favoriteId = tour.tourId || tour.route.id;
    if (isFavorite(favoriteId)) {
      await removeFromFavorites(favoriteId);
      return;
    }

    await addToFavorites({
      id: favoriteId,
      title: tour.displayName,
      description: tour.cityLabel || 'Tour',
      image:
        tour.places[0]?.imageUrl ||
        tour.favoritePlace?.imageUrl ||
        tour.events[0]?.coverImage ||
        '',
      category: 'Route',
      routeName: 'MyTourStart',
      routeParams: {
        routeId: tour.route.id,
        routeName: tour.displayName,
        tourName: tour.displayName,
        cityLabel: tour.cityLabel,
        extraPlaceIds: tour.extraPlaces.map((place) => place.id),
        removedPlaceIds: tour.removedPlaceIds,
        tourId: tour.tourId,
        isEdited:
          Boolean(tour.isSavedTour) ||
          tour.extraPlaces.length > 0 ||
          tour.removedPlaceIds.length > 0,
      },
      city_name: tour.route.city_name,
      country: tour.route.country,
    });
  };

  const allCards = useMemo(
    () => [...savedTourCards, ...routeCards],
    [routeCards, savedTourCards]
  );

  const visibleCards = useMemo(() => {
    switch (activeFilter) {
      case 'Scheduled':
        return allCards.filter((tour) => tour.status === 'active' || tour.route.isScheduled);
      case 'Favourite':
        return allCards.filter((tour) => isFavorite(tour.tourId || tour.route.id));
      case 'Completed':
        return allCards.filter((tour) => tour.status === 'completed');
      default:
        return allCards;
    }
  }, [activeFilter, allCards, isFavorite]);

  const allRoutePlaces = (tour: RouteCardState) => {
    const favoritePlaces =
      tour.favoritePlaces.length > 0
        ? tour.favoritePlaces
        : tour.favoritePlace
          ? [tour.favoritePlace]
          : [];
    const merged = [...tour.places, ...tour.extraPlaces, ...favoritePlaces].filter(
      (place) => !tour.removedPlaceIds.includes(place.id)
    );
    const seen = new Set<string>();
    return merged.filter((place) => {
      if (seen.has(place.id)) {
        return false;
      }
      seen.add(place.id);
      return true;
    });
  };

  const renderEmptyState = () => (
    <View style={[styles.content, { paddingBottom: bottomHeight + 40 }]}>
      <MapIconMain width={190} height={121.32} />

      <Text style={styles.noTours}>No Tours Yet</Text>

      <Text style={styles.desc}>
        You haven&apos;t planned any adventures. Create your first tour to start
        exploring the city.
      </Text>

      <TouchableOpacity style={styles.btnContainer} onPress={() => openModal('location')}>
        <Text style={styles.btn}>Create A Tour</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFilteredEmptyState = () => {
    const messageMap: Record<TourFilter, string> = {
      All: 'No tours found right now.',
      Scheduled: 'There are no scheduled tours yet.',
      Favourite: 'There are no favourite tours yet.',
      Completed: 'There are no completed tours yet.',
    };

    return (
      <View style={styles.filteredEmptyWrap}>
        <Text style={styles.filteredEmptyTitle}>{messageMap[activeFilter]}</Text>
      </View>
    );
  };

  const renderTourCard = (tour: RouteCardState) => {
    const locations = allRoutePlaces(tour);
    const previewImage =
      tour.places[0]?.imageUrl ||
      tour.favoritePlace?.imageUrl ||
      tour.events[0]?.coverImage ||
      '';

    return (
      <View
        key={tour.cardId}
        style={styles.tourCard}
      >
        <View style={styles.cardTop}>
          <Image source={{ uri: previewImage }} style={styles.imagePlaceholder} />
          <View style={styles.cardInfo}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.tourTitle}>{tour.displayName}</Text>

              <View style={styles.iconRow}>
                <TouchableOpacity style={styles.topIcons} onPress={() => deleteTour(tour.cardId)}>
                  <IconDelete width={15} height={15} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.topIcons} onPress={() => toggleTour(tour.cardId)}>
                  <IconUp width={15} height={15} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.iconInfoRow}>
              <View style={styles.iconTextGroup}>
                <TourLocationIcon width={20} height={20} />
                <Text style={styles.textInfo}>Visit {locations.length} Locations</Text>
              </View>

              <View style={styles.iconTextGroup}>
                <TourDateIcon width={20} height={20} />
                <Text style={styles.textInfo}>
                  {tour.route.dateRange?.startDate || 'Flexible'}
                </Text>
              </View>
            </View>

            <View style={styles.iconInfoRow}>
              <View style={styles.iconTextGroup}>
                <EarnedPointIcon width={20} height={20} />
                <Text style={styles.textInfo}>
                  Earn <Text style={styles.textGreen}>+{locations.length * 15}</Text> Points
                </Text>
              </View>
            </View>

            <View style={styles.cardActionRow}>
              <TouchableOpacity
                style={styles.cardFavoriteBtn}
                onPress={() => handleToggleFavorite(tour)}
              >
                {isFavorite(tour.tourId || tour.route.id) ? (
                  <RedHeartIcon width={14} height={12} />
                ) : (
                  <HeartIcon width={14} height={12} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardStartBtn}
                onPress={() => handleStartTour(tour)}
              >
                <Text style={styles.cardStartBtnText}>Start Tour</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {tour.isOpen && (
          <View style={styles.cardBottom}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationTitle}>Locations</Text>

              <TouchableOpacity
                style={styles.addLocBtn}
                onPress={() =>
                  navigation.navigate('AddLocations', {
                    routeId: tour.route.id,
                    cityLabel: tour.cityLabel,
                    fromScreen: 'MyTour',
                    routeName: tour.displayName,
                    tourName: tour.displayName,
                    extraPlaceIds: tour.extraPlaces.map((place) => place.id),
                    removedPlaceIds: tour.removedPlaceIds,
                    isEdited:
                      tour.extraPlaces.length > 0 ||
                      tour.removedPlaceIds.length > 0,
                  })
                }
              >
                <IconPlus width={11} height={11} />
                <Text style={styles.addLocation}>Add Locations</Text>
              </TouchableOpacity>
            </View>

            {locations.map((loc) => (
              <View key={loc.id} style={styles.locationRow}>
                <View style={styles.locationLeft}>
                  <CreatedTourLocationIcon width={20} height={20} />
                  <Text style={styles.locationText}>{loc.name}</Text>
                </View>
              </View>
            ))}

            {tour.events.length > 0 ? (
              <>
                <Text style={styles.eventsTitle}>Events</Text>
                {tour.events.map((event) => (
                  <View key={event.id} style={styles.locationRow}>
                    <View style={styles.locationLeft}>
                      <CreatedTourLocationIcon width={20} height={20} />
                      <Text style={styles.locationText}>{event.title}</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopHeader title="My Tours" />

      {loadingRoutes ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
        </View>
      ) : allCards.length <= 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollGrow}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['All', 'Scheduled', 'Favourite', 'Completed'] as TourFilter[]).map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.filterChip,
                  activeFilter === item && styles.filterChipActive,
                ]}
                onPress={() => setActiveFilter(item)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === item && styles.filterChipTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {visibleCards.length > 0 ? (
            <View style={styles.tourList}>{visibleCards.map(renderTourCard)}</View>
          ) : (
            renderFilteredEmptyState()
          )}

          <View style={styles.bottomBtn}>
            <CustomButton title="Create Another Tour" onPress={() => openModal('location')} />
          </View>
        </ScrollView>
      )}

      <LocationModal
        visible={modals.location}
        title="Select Your Location"
        locations={locationSuggestions}
        searchValue={locationSearch}
        onSearchChange={setLocationSearch}
        loadingSuggestions={loadingSuggestions}
        onClose={() => closeModal('location')}
        onNext={(location) => {
          setSelectedLocation(location);
          closeModal('location');
          openModal('preference');
        }}
      />

      <PreferenceModal
        visible={modals.preference}
        preferences={tagNames}
        selectedPrefs={selectedPrefs}
        togglePreference={togglePreference}
        clearAll={() => setSelectedPrefs([])}
        onClose={() => closeModal('preference')}
        mode="myTour"
        showTwoButtons
        secondaryLabel="Back"
        primaryLabel="Next"
        onSecondary={() => {
          closeModal('preference');
          openModal('location');
        }}
        onPrimary={handleOpenNameModal}
      />

      <NameTourModal
        visible={modals.name}
        tourName={tourName}
        setTourName={setTourName}
        onClose={() => closeModal('name')}
        onConfirm={handleConfirmTour}
      />
    </View>
  );
};

export default MyTour;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginTop: 149,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noTours: {
    marginTop: 30,
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  desc: {
    marginTop: 14,
    width: 327,
    textAlign: 'center',
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  btnContainer: {
    marginTop: 28,
    paddingHorizontal: 52,
    height: 50,
    borderRadius: 40,
    backgroundColor: COLORS.BUTTON_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  tourList: {
    paddingHorizontal: 23,
    paddingTop: 8,
  },
  bottomBtn: {
    width: '100%',
    paddingHorizontal: 23,
    paddingBottom: 26,
  },
  scrollGrow: {
    paddingBottom: 12,
  },
  filteredEmptyWrap: {
    flex: 1,
    minHeight: 420,
    paddingHorizontal: 23,
    paddingTop: 24,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filteredEmptyTitle: {
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  filterRow: {
    paddingHorizontal: 23,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 10,
  },
  filterChip: {
    height: 46,
    minWidth: 88,
    paddingHorizontal: 20,
    borderRadius: 23,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  filterChipActive: {
    backgroundColor: COLORS.BUTTON_COLOR,
    borderColor: COLORS.BUTTON_COLOR,
  },
  filterChipText: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.TEXT_PRIMARY,
  },
  filterChipTextActive: {
    color: COLORS.WHITE,
  },
  tourCard: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: COLORS.WHITE,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTop: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 6.7,
    backgroundColor: '#EDEDED',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  tourTitle: {
    flex: 1,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  iconInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 12,
  },
  topIcons: {
    height: 20,
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  textInfo: {
    fontSize: FONT_SIZE.PILL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
    flexShrink: 1,
  },
  textGreen: {
    color: COLORS.TEXT_GREEN,
  },
  cardActionRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardFavoriteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
  },
  cardStartBtn: {
    height: 36,
    minWidth: 112,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: COLORS.BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStartBtnText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.PILL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  cardBottom: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: '#95D8EA20',
  },
  locationHeader: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  addLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addLocation: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.BUTTON_COLOR,
  },
  locationRow: {
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  locationText: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_PRIMARY,
  },
  eventsTitle: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
});
