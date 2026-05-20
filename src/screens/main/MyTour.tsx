import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
    CreatedTourLocationIcon,
    DownArrow,
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
import { showError, showInfo, showSuccess } from '../../components/common/AppToast';
import {
    deleteUserTour,
    fetchUserTours,
    fetchUserTourById,
    fetchPlacesByIds,
    fetchRecommendedRoutes,
    fetchRouteDetails,
    fetchTourTags,
    saveUserTour,
    scheduleOtherActiveTours,
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
    scheduledDate?: string | null;
    isSavedTour?: boolean;
    updatedAt?: string;
    createdAt?: string;
};

type TourFilter = 'All' | 'Current' | 'Paused' | 'Scheduled' | 'Favourite' | 'Completed';

type TourStatusUpdate = {
    tourId?: string;
    routeId?: string;
    status?: string;
    updatedAt?: string;
};

const buildTourIdentityKey = (tour: Pick<RouteCardState, 'displayName' | 'route'>) =>
    `${tour.route.id}::${(tour.displayName || '').trim().toLowerCase()}`;

const buildPlaceProgressFromSavedTour = (savedTour: SavedTour) =>
    savedTour.all_places.reduce<
        Record<
            string,
            {
                visited: boolean;
                visitedAt?: string | null;
                proofImageUri?: string | null;
                pointsEarned?: number;
                addedByUser?: boolean;
            }
        >
    >((acc, item) => {
        acc[item.place_id] = {
            visited: item.visited,
            visitedAt: item.visitedAt,
            proofImageUri: item.proofImageUri,
            pointsEarned: item.pointsEarned,
            addedByUser: item.addedByUser,
        };
        return acc;
    }, {});

const applyTourStatusUpdate = (
    item: RouteCardState,
    update?: TourStatusUpdate
): RouteCardState => {
    if (!update) {
        return item;
    }

    const matchesTourId = update.tourId && item.tourId === update.tourId;
    const matchesRouteId = update.routeId && item.route.id === update.routeId;

    if (!matchesTourId && !matchesRouteId) {
        return item;
    }

    return {
        ...item,
        status: (update.status as RouteCardState['status']) || item.status,
        updatedAt: update.updatedAt || new Date().toISOString(),
    };
};

const MyTour = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<NavigationProp>();
    const bottomHeight = useBottomTabBarHeight();
    const authUser = useSelector((state: RootState) => state.auth.user);
    const userId = authUser?.id;
    const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
    const [modals, setModals] = useState({
        location: false,
        preference: false,
        name: false,
    });
    const [pendingRecommendations, setPendingRecommendations] = useState<RecommendedRoute[]>([]);
    const [tags, setTags] = useState<FirebaseTag[]>([]);
    const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
    const [tourName, setTourName] = useState('');
    const [routeCards, setRouteCards] = useState<RouteCardState[]>([]);
    const [locationSearch, setLocationSearch] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [loadingRoutes, setLoadingRoutes] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savedTourCards, setSavedTourCards] = useState<RouteCardState[]>([]);
    const [activeFilter, setActiveFilter] = useState<TourFilter>('All');
    const addedRouteId = route.params?.routeId;
    const addedPlaceId = route.params?.addedPlaceId;
    const tourUpdate = route.params?.tourUpdate as TourStatusUpdate | undefined;

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

    const loadTags = useCallback(async () => {
        try {
            const fetchedTags = await fetchTourTags();
            setTags(fetchedTags);
        } catch {
            setTags([]);
        }
    }, []);

    const loadSavedTours = useCallback(async () => {
        if (!userId) {
            setSavedTourCards([]);
            return;
        }

        try {
            const tours = await fetchUserTours(userId);
            if (!tours || tours.length === 0) {
                setSavedTourCards([]);
                return;
            }

            // 1. PERFORMANCE WIN: Extract and deduplicate all place IDs from ALL tours up front
            const allPlaceIds = Array.from(
                new Set(tours.flatMap((t) => t.all_places?.map((p) => p.place_id) || []))
            );

            // 2. PERFORMANCE WIN: Run batch fetches in parallel for the entire screen data at once
            const [globalPlaces, ...allRouteDetails] = await Promise.all([
                allPlaceIds.length > 0 ? fetchPlacesByIds(allPlaceIds) : Promise.resolve([]),
                ...tours.map((t) =>
                    fetchRouteDetails({ routeId: t.route_id, userId }).catch(() => null)
                ),
            ]);

            // Create a fast-lookup map for places: O(1) complexity instead of O(N) filtering inside array map
            const placesMap = new Map((globalPlaces || []).map((p) => [p.id, p]));

            // Match route details array position back to its corresponding tour
            const routeDetailsMap = new Map(
                tours.map((t, index) => [t.route_id, allRouteDetails[index]])
            );

            // 3. Assemble the state cards instantly using the mapping cache
            const cards = tours.map((tour) => {
                const details = routeDetailsMap.get(tour.route_id);

                const fallbackRoute = details || {
                    route: {
                        id: tour.route_id,
                        name: tour.title || 'Custom Tour',
                        city_name: tour.city_name || '',
                        country: tour.country || '',
                        dateRange: { startDate: 'Flexible' }
                    },
                    places: [],
                    events: [],
                    favoritePlace: null,
                    favoritePlaces: []
                };

                // Map internal IDs using our flat global memory array cache
                const tourPlaces = (tour.all_places || [])
                    .map((p) => placesMap.get(p.place_id))
                    .filter((p): p is FirebasePlace => !!p);

                const extraPlaces = tourPlaces.filter((place) =>
                    tour.all_places?.some(
                        (item) => item.place_id === place.id && item.addedByUser
                    )
                );

                return {
                    ...fallbackRoute,
                    cardId: `saved-${tour.id}`,
                    isOpen: false, // Keeping it false speeds up initial structural UI rendering layouts
                    displayName: tour.title || fallbackRoute.route.name,
                    cityLabel:
                        [tour.city_name, tour.country].filter(Boolean).join(', ') ||
                        [fallbackRoute.route.city_name, fallbackRoute.route.country].filter(Boolean).join(', '),
                    extraPlaces,
                    removedPlaceIds: [],
                    tourId: tour.id,
                    status: tour.status,
                    scheduledDate: tour.scheduledDate || null,
                    isSavedTour: true,
                    updatedAt: tour.updatedAt || tour.createdAt || '',
                    createdAt: tour.createdAt || tour.updatedAt || '',
                    places: tourPlaces,
                } satisfies RouteCardState;
            });

            setSavedTourCards(cards);
        } catch (error) {
            console.error("Error inside optimized loadSavedTours runner:", error);
            // Only clear if absolutely necessary to prevent layout blinking shifts
        } finally {
            setInitialLoad(false);
        }
    }, [userId]);
    useEffect(() => {
        loadTags();
    }, [loadTags]);

    useEffect(() => {
        loadSavedTours();
    }, [loadSavedTours]);

    useFocusEffect(
        useCallback(() => {
            loadSavedTours();
        }, [loadSavedTours])
    );

    useEffect(() => {
        if (!tourUpdate?.status) {
            return;
        }

        setRouteCards((prev) => prev.map((item) => applyTourStatusUpdate(item, tourUpdate)));
        setSavedTourCards((prev) => prev.map((item) => applyTourStatusUpdate(item, tourUpdate)));
    }, [tourUpdate]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([loadTags(), loadSavedTours()]);
        } finally {
            setRefreshing(false);
        }
    }, [loadSavedTours, loadTags]);

    useEffect(() => {
        if (!addedRouteId || !addedPlaceId) {
            return;
        }

        fetchPlacesByIds([addedPlaceId]).then((places) => {
            const addedPlace = places[0];

            if (!addedPlace) {
                return;
            }

            const applyAdd = (item: RouteCardState): RouteCardState => {
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
            };

            setRouteCards((prev) => prev.map(applyAdd));
            setSavedTourCards((prev) => prev.map(applyAdd));
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

    const handleOpenNameModal = async () => {
        setLoadingRoutes(true);

        try {
            const recommendations = await fetchRecommendedRoutes({
                locationLabel: selectedLocation || locationSearch,
                selectedTagIds,
                userId,
            });

            setPendingRecommendations(recommendations);
            const suggestedName = recommendations[0]?.route?.name?.trim();
            setTourName(suggestedName || '');
            closeModal('preference');
            openModal('name');
        } finally {
            setLoadingRoutes(false);
        }
    };

    const handleNameConfirm = () => {
        closeModal('name');
        handleFinalConfirm();
    };

    const handleFinalConfirm = async (scheduledDate?: string) => {
        if (pendingRecommendations.length === 0) return;
        setLoadingRoutes(true);

        try {
            const now = new Date().toISOString();
            const cards: RouteCardState[] = await Promise.all(
                pendingRecommendations.map(async (item) => {
                    const status = scheduledDate ? 'scheduled' : 'active';
                    let savedTourId: string | undefined;

                    if (scheduledDate && userId) {
                        savedTourId = await saveUserTour({
                            tourId: null,
                            userId,
                            userName: authUser?.name || '',
                            userEmail: authUser?.email || '',
                            route: item.route,
                            title: tourName.trim() || item.route.name,
                            places: item.places,
                            events: item.events,
                            placeProgress: {},
                            currentStopIndex: 0,
                            isEdited: false,
                            status: 'scheduled',
                            scheduledDate,
                        });
                    }

                    return {
                        ...item,
                        cardId: savedTourId ? `saved-${savedTourId}` : `route-${item.route.id}`,
                        isOpen: true,
                        displayName: tourName.trim() || item.route.name,
                        cityLabel:
                            [item.route.city_name, item.route.country].filter(Boolean).join(', ') ||
                            selectedLocation ||
                            locationSearch,
                        extraPlaces: [],
                        removedPlaceIds: [],
                        status,
                        scheduledDate: scheduledDate || null,
                        tourId: savedTourId,
                        isSavedTour: Boolean(scheduledDate),
                        updatedAt: now,
                        createdAt: now,
                    };
                })
            );

            if (scheduledDate) {
                setSavedTourCards((prev) => [...cards, ...prev]);
            } else {
                await scheduleOtherActiveTours({ userId, scheduledDate: now });
                setSavedTourCards((prev) =>
                    prev.map((tour) =>
                        tour.status === 'active'
                            ? {
                                ...tour,
                                status: 'scheduled',
                                scheduledDate: tour.scheduledDate || now,
                                updatedAt: now,
                            }
                            : tour
                    )
                );
                setRouteCards((prev) => {
                    const demoted = prev.map((tour) =>
                        tour.status === 'active'
                            ? {
                                ...tour,
                                status: 'scheduled',
                                scheduledDate: tour.scheduledDate || now,
                                updatedAt: now,
                            }
                            : tour
                    );
                    return [...cards, ...demoted];
                });
            }
            clearFlow();
            setPendingRecommendations([]);
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

    const deleteTour = useCallback(async (tour: RouteCardState) => {
        try {
            if (tour.tourId) {
                await deleteUserTour(tour.tourId);
            }

            setRouteCards((prev) => prev.filter((routeCard) => routeCard.cardId !== tour.cardId));
            setSavedTourCards((prev) => prev.filter((routeCard) => routeCard.cardId !== tour.cardId));
            showInfo('Tour Removed', 'This tour has been removed.');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unable to remove this tour right now.';
            showError('Delete Failed', message);
        }
    }, []);

    const handleStartTour = async (tour: RouteCardState) => {
        let savedTourId = tour.tourId || null;

        // For non-completed tours, immediately persist as active before navigating
        // so the user lands on MyTourStart in a started state.
        if (userId && tour.status !== 'completed') {
            try {
                const now = new Date().toISOString();
                const existingSavedTour = savedTourId
                    ? await fetchUserTourById(savedTourId)
                    : null;
                const allPlaces = allRoutePlaces(tour);
                let placesToPersist = allPlaces;
                let placeProgress = {};

                if (existingSavedTour) {
                    placeProgress = buildPlaceProgressFromSavedTour(existingSavedTour);
                    const persistedPlaces = await fetchPlacesByIds(
                        existingSavedTour.all_places.map((item) => item.place_id)
                    );
                    const persistedPlaceMap = new Map(
                        persistedPlaces.map((place) => [place.id, place])
                    );
                    const orderedPersistedPlaces = existingSavedTour.all_places
                        .map((item) => persistedPlaceMap.get(item.place_id))
                        .filter((place): place is FirebasePlace => Boolean(place));
                    placesToPersist =
                        orderedPersistedPlaces.length > 0 ? orderedPersistedPlaces : allPlaces;
                }

                savedTourId = await saveUserTour({
                    tourId: tour.tourId || null,
                    userId,
                    userName: authUser?.name || '',
                    userEmail: authUser?.email || '',
                    route: tour.route,
                    title: tour.displayName,
                    places: placesToPersist,
                    events: tour.events,
                    placeProgress,
                    currentStopIndex: existingSavedTour?.currentStopIndex || 0,
                    isEdited: existingSavedTour?.isEdited ||
                        Boolean(tour.isSavedTour) ||
                        tour.extraPlaces.length > 0 ||
                        tour.removedPlaceIds.length > 0,
                    status: 'active',
                    startedAt: existingSavedTour?.startedAt || now,
                    completedAt: null,
                    scheduledDate: null,
                });

                setSavedTourCards((prev) =>
                    prev.map((item) =>
                        item.tourId === savedTourId
                            ? {
                                ...item,
                                status: 'active',
                                updatedAt: now,
                                scheduledDate: null,
                            }
                            : item
                    )
                );
                setRouteCards((prev) =>
                    prev
                        .filter((routeCard) => routeCard.cardId !== tour.cardId)
                        .map((routeCard) =>
                            routeCard.status === 'active'
                                ? {
                                    ...routeCard,
                                    status: 'scheduled',
                                    scheduledDate: routeCard.scheduledDate || now,
                                    updatedAt: now,
                                }
                                : routeCard
                        )
                );
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : 'Unable to start this tour right now.';
                showError('Start Tour Failed', message);
                return;
            }
        }

        navigation.navigate('MyTourStart', {
            routeId: tour.route.id,
            routeName: tour.displayName,
            tourName: tour.displayName,
            cityLabel: tour.cityLabel,
            selectedTagIds,
            extraPlaceIds: tour.extraPlaces.map((place) => place.id),
            removedPlaceIds: tour.removedPlaceIds,
            tourId: savedTourId || undefined,
            autoStart: tour.status !== 'completed',
            isEdited:
                Boolean(tour.isSavedTour) ||
                tour.extraPlaces.length > 0 ||
                tour.removedPlaceIds.length > 0,
        });
    };

    const handleToggleFavorite = async (tour: RouteCardState) => {
        const favoriteId = tour.tourId || tour.route.id;
        if (isFavorite(favoriteId)) {
            await removeFromFavorites(favoriteId, 'Route');
            showInfo(
                'Removed from Favorites',
                `${tour.displayName} removed successfully`
            );

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
        showSuccess(
            'Added to Favorites',
            `${tour.displayName} added successfully`
        );
    };

    const allCards = useMemo(() => {
        const statusPriority = (status?: string) => {
            if (status === 'active') return 0;
            if (status === 'paused') return 1;
            if (status === 'scheduled') return 2;
            if (status === 'completed') return 3;
            return 4;
        };

        const latestSavedByKey = new Map<string, string>();
        savedTourCards.forEach((tour) => {
            latestSavedByKey.set(
                buildTourIdentityKey(tour),
                tour.updatedAt || tour.createdAt || ''
            );
        });

        const dedupedRouteCards = routeCards.filter((tour) => {
            const savedTime = latestSavedByKey.get(buildTourIdentityKey(tour));
            const localTime = tour.updatedAt || tour.createdAt || '';
            return !savedTime || savedTime < localTime;
        });

    const merged = [...savedTourCards, ...dedupedRouteCards];
    const seenCardIds = new Set<string>();
    const uniqueMerged = merged.filter((card) => {
      if (seenCardIds.has(card.cardId)) return false;
      seenCardIds.add(card.cardId);
      return true;
    });

    return uniqueMerged.sort((a, b) => {
      const statusDiff = statusPriority(a.status) - statusPriority(b.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }

            const aTime = a.updatedAt || a.createdAt || '';
            const bTime = b.updatedAt || b.createdAt || '';
            return bTime.localeCompare(aTime);
        });
    }, [routeCards, savedTourCards]);

    const visibleCards = useMemo(() => {
        switch (activeFilter) {
            case 'Current':
                return allCards.filter((tour) => tour.status === 'active');
            case 'Paused':
                return allCards.filter((tour) => tour.status === 'paused');
            case 'Scheduled':
                return allCards.filter((tour) => tour.status === 'scheduled');
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
    const [isRefreshEnabled, setIsRefreshEnabled] = useState(true);
    const handleScrollOffsetDetect = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset } = event.nativeEvent;
        // Only enable pulling gestures when user explicitly drags significantly past the zero anchor limit
        if (contentOffset.y <= -45) {
            setIsRefreshEnabled(true);
        } else if (contentOffset.y > 0) {
            setIsRefreshEnabled(false);
        }
    };

    const renderEmptyState = () => (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.emptyScrollContent}
            refreshControl={
                // <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.BUTTON_COLOR} />
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={COLORS.BUTTON_COLOR}
                    enabled={isRefreshEnabled}
                />
            }
        >
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
        </ScrollView>
    );

    const renderFilteredEmptyState = () => {
        const messageMap: Record<TourFilter, string> = {
            All: 'No tours found right now.',
            Current: 'No active tours right now.',
            Paused: 'No paused tours right now.',
            Scheduled: 'No scheduled tours yet.',
            Favourite: 'No favourite tours yet.',
            Completed: 'No completed tours yet.',
        };

        return (
            <View style={styles.filteredEmptyWrap}>
                <Text style={styles.filteredEmptyTitle}>{messageMap[activeFilter]}</Text>
            </View>
        );
    };

    const getTourStatusBadge = (tour: RouteCardState): { label: string; color: string } | null => {
        if (tour.status === 'paused') return { label: 'Paused', color: '#F59E0B' };
        if (tour.status === 'scheduled') {
            const dateStr = tour.scheduledDate
                ? new Date(tour.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Scheduled';
            return { label: dateStr, color: COLORS.BUTTON_COLOR };
        }
        if (tour.status === 'completed') return { label: 'Completed', color: COLORS.TEXT_GREEN };
        return null;
    };

    const getStartBtnLabel = (tour: RouteCardState): string => {
        if (tour.status === 'paused') return 'Resume Tour';
        if (tour.status === 'completed') return 'View Tour';
        if (tour.status === 'scheduled') return 'Start Tour';
        return 'Start Tour';
    };

    const renderTourCard = (tour: RouteCardState) => {
        const locations = allRoutePlaces(tour);
        const previewImage =
            tour.places[0]?.imageUrl ||
            tour.favoritePlace?.imageUrl ||
            tour.events[0]?.coverImage ||
            '';
        const badge = getTourStatusBadge(tour);

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
                                <TouchableOpacity style={styles.topIcons} onPress={() => deleteTour(tour)}>
                                    <IconDelete width={15} height={15} />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.topIcons} onPress={() => toggleTour(tour.cardId)}>
                                    {
                                        tour.isOpen ?
                                            <IconUp width={16} height={16} />
                                            :
                                            <DownArrow width={16} height={16} />

                                    }
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
                            {badge ? (
                                <View style={[styles.statusBadge, { backgroundColor: badge.color + '20', borderColor: badge.color }]}>
                                    <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
                                </View>
                            ) : null}

                        </View>
                    </View>
                </View>

                {tour.isOpen && (
                    <View style={styles.cardBottom}>
                        <View style={styles.locationHeader}>
                            <Text style={styles.locationTitle}>Locations</Text>

                            {tour.status !== 'completed' ? (
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
                            ) : null}
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
                        <TouchableOpacity
                            style={styles.cardStartBtn}
                            onPress={() => handleStartTour(tour)}
                        >
                            <Text style={styles.cardStartBtnText}>
                                {getStartBtnLabel(tour)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <TopHeader title="My Tours" />

            {loadingRoutes || initialLoad ? (
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
                </View>
            ) : allCards.length === 0 ? (
                renderEmptyState()
            ) : (
                <View style={styles.mainContent}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[
                            styles.scrollGrow,
                            { paddingBottom: bottomHeight - 55 },
                        ]}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                tintColor={COLORS.BUTTON_COLOR}
                            />
                        }
                    >
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            {(['All', 'Current', 'Paused', 'Scheduled', 'Favourite', 'Completed'] as TourFilter[]).map((item) => (
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
                    </ScrollView>

                    <View
                        style={styles.bottomBtn}
                    >
                        <CustomButton title="Create New Tour" onPress={() => openModal('location')} />
                    </View>
                </View>
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
                onConfirm={handleNameConfirm}
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
    emptyScrollContent: {
        flexGrow: 1,
    },
    mainContent: {
        flex: 1,
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
        position: 'absolute',
        bottom: 10,
        left: 0,
        right: 0,
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
        justifyContent: 'space-between'
    },
    imagePlaceholder: {
        width: 70,
        height: 100,
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
        // marginTop: 8,
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
        marginTop: 10
    },
    cardStartBtnText: {
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TEXT,
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
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: 10,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },
});
