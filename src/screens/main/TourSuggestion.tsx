import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { CommonActions, useNavigation, usePreventRemove, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { CustomAlert } from '../../utils/CustomAlert';
import TopHeader from '../../components/Home/TopHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import {
    CreatedTourLocationIcon,
    DownArrow,
    EarnedPointIcon,
    IconDelete,
    IconPlus,
    IconUp,
    TourDateIcon,
    TourLocationIcon,
    EditProfileIcon,
} from '../../constants/icons';
import NameTourModal from '../../components/modals/NameTourModal';
import { showError, showSuccess } from '../../components/common/AppToast';
import { MyTourStackParamList } from '../../types/types';
import { RootState } from '../../Redux/store';
import { fetchUpcomingEventSuggestions } from '../../services/myTourService';
import firestore from '@react-native-firebase/firestore';
import {
    FirebaseEvent,
    FirebasePlace,
    fetchPlacesByIds,
    RecommendedRoute,
    removeTourPlaceFromUserAndRecord,
    saveUserTour,
    buildNavigableRouteFromStops,
} from '../../services/myTourService';
import { scheduleStopsWithEventTiming } from '../../utils/tourRouteScheduling';
import { useFavorites } from '../../context/FavoritesContext';

type NavigationProp = NativeStackNavigationProp<MyTourStackParamList, 'TourSuggestion'>;
const POINTS_PER_LOCATION = 15;
const TAB_ROUTE_NAMES = new Set(['MyTours', 'Map', 'ForYou', 'Favorites']);

const TourSuggestion: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<any>();
    const authUser = useSelector((state: RootState) => state.auth.user);
    const userId = authUser?.id;
    const { removeFromFavorites, isFavorite } = useFavorites();

    const params = route.params as {
        tourName?: string;
        cityLabel?: string;
        recommendations?: RecommendedRoute[];
        addedPlaceId?: string;
        timestamp?: number;
    } | undefined;

    const recommendations = params?.recommendations || [];
    const initialTourName = params?.tourName || recommendations[0]?.route?.name || 'Custom Tour';
    const [tourNameState, setTourNameState] = useState<string>(initialTourName);
    const [nameModalVisible, setNameModalVisible] = useState(false);
    const cityLabel = params?.cityLabel || '';
    const primary = recommendations[0];
    const initialPlaces: FirebasePlace[] = primary?.places || [];

    const [places, setPlaces] = useState<FirebasePlace[]>(initialPlaces);
    const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});
    const totalPoints = useMemo(() => places.length * POINTS_PER_LOCATION, [places.length]);

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [suggestedEvents, setSuggestedEvents] = useState<FirebaseEvent[]>([]);
    const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [existingTourId, setExistingTourId] = useState<string | null>(null);
    const bypassGuardRef = useRef(false);

    // Combine current route template events with external live suggestions
    const allAvailableEvents = useMemo(() => {
        const templateEvents = primary?.events || [];
        // Prevent duplicate IDs if suggested matches template
        const templateIds = new Set(templateEvents.map(e => e.id));
        const filteredSuggestions = suggestedEvents.filter(e => !templateIds.has(e.id));
        const all = [...templateEvents, ...filteredSuggestions];
        console.log('DEBUG TourSuggestion - allAvailableEvents:', {
            templateEvents: templateEvents.length,
            suggestedEvents: suggestedEvents.length,
            filteredSuggestions: filteredSuggestions.length,
            total: all.length,
            events: all.map(e => ({ id: e.id, title: e.title }))
        });
        return all;
    }, [suggestedEvents, primary?.events]);

    // Derive selected event objects using the master array list
    const selectedEvents = useMemo(() => {
        const selected = allAvailableEvents.filter((event) =>
            selectedEventIds.includes(event.id)
        );
        console.log('DEBUG TourSuggestion - selectedEvents:', {
            selectedEventIds,
            found: selected.length,
            events: selected.map(e => ({ id: e.id, title: e.title }))
        });
        return selected;
    }, [allAvailableEvents, selectedEventIds]);

    // Filter suggestions pool to exclude anything selected
    const availableSuggestions = useMemo(
        () => suggestedEvents.filter((event) => !selectedEventIds.includes(event.id)),
        [suggestedEvents, selectedEventIds]
    );

    const parseEventSortTime = (event: FirebaseEvent) => {
        if (!event.startDate) {
            return Number.MAX_SAFE_INTEGER;
        }
        const parsed = new Date(`${event.startDate}T${event.startTime || '00:00'}`).getTime();
        return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    };

    const buildSuggestedNavigableRoute = (
        routePlaces: FirebasePlace[],
        routeEvents: FirebaseEvent[]
    ) => {
        const placeStops = routePlaces
            .filter((place) =>
                place.coordinates?.longitude !== undefined &&
                place.coordinates?.latitude !== undefined
            )
            .map((place) => ({
                id: place.id,
                kind: 'place' as const,
                coordinate: [
                    Number(place.coordinates?.longitude),
                    Number(place.coordinates?.latitude),
                ] as [number, number],
            }));

        const eventStops = routeEvents
            .filter((event) =>
                event.coordinates?.longitude !== undefined &&
                event.coordinates?.latitude !== undefined
            )
            .map((event) => ({
                id: event.id,
                kind: 'event' as const,
                event,
                sortTime: parseEventSortTime(event),
                coordinate: [
                    Number(event.coordinates?.longitude),
                    Number(event.coordinates?.latitude),
                ] as [number, number],
            }));

        const stops = [...placeStops, ...eventStops];
        if (stops.length === 0) {
            return [];
        }

        const orderedStops = scheduleStopsWithEventTiming(
            stops,
            () => false,
            stops[0].coordinate,
            Date.now()
        );

        return buildNavigableRouteFromStops(orderedStops);
    };

    const previewImage =
        places[0]?.imageUrl ||
        primary?.favoritePlace?.imageUrl ||
        allAvailableEvents[0]?.coverImage ||
        '';
    const dateLabel = primary?.route?.dateRange?.startDate;

    const toggleEventSelection = useCallback((eventId: string) => {
        setSelectedEventIds((prev) => {
            if (prev.includes(eventId)) {
                return prev.filter((id) => id !== eventId);
            }
            return [...prev, eventId];
        });
    }, []);

    const removeEventSuggestion = useCallback((eventId: string) => {
        setSuggestedEvents((prev) => prev.filter((event) => event.id !== eventId));
        setSelectedEventIds((prev) => prev.filter((id) => id !== eventId));
    }, []);

    const removeAllSuggestions = useCallback(() => {
        setSuggestedEvents([]);
        // Only remove event selections that belong to the dynamic suggestions pool
        const templateIds = (primary?.events || []).map(e => e.id);
        setSelectedEventIds((prev) => prev.filter((id) => templateIds.includes(id)));
    }, [primary?.events]);

    const removeSelectedEvent = useCallback((eventId: string) => {
        setSelectedEventIds((prev) => prev.filter((id) => id !== eventId));
    }, []);

    // 1. First, fetch already saved document entries if they exist
    useEffect(() => {
        const loadSavedEvents = async () => {
            try {
                if (!primary?.route?.id || !userId) return;
                const doc = await firestore()
                    .collection('tours')
                    .where('user_id', '==', userId)
                    .where('route_id', '==', primary.route.id)
                    .where('status', '==', 'saved')
                    .limit(1)
                    .get();
                if (!doc.empty) {
                    const tourDoc = doc.docs[0];
                    const data = tourDoc.data();
                    // Try to get event IDs from top-level (legacy) or from all_places (new structure)
                    let ids = data?.event_ids || [];
                    if (ids.length === 0 && data?.all_places && Array.isArray(data.all_places)) {
                        // Extract event IDs from all_places entries that have event_id field
                        ids = data.all_places
                            .filter((item: any) => item.event_id)
                            .map((item: any) => item.event_id);
                    }
                    setExistingTourId(tourDoc.id);
                    setSelectedEventIds(ids);
                } else {
                    setExistingTourId(null);
                    // Fallback: Default pre-select all standard template route events if no document exists yet
                    const initialIds = (primary?.events || []).map(e => e.id);
                    setSelectedEventIds(initialIds);
                }
            } catch (e) {
                console.log('restore events error', e);
            }
        };
        loadSavedEvents();
    }, [primary?.route?.id, primary?.events, userId]);

    // 2. Load API event suggestions without stepping on selected states
    const loadEventSuggestions = useCallback(async () => {
        if (!primary) return;
        setLoadingEvents(true);
        try {
            const locationLabel =
                cityLabel || [primary.route.city_name, primary.route.country].filter(Boolean).join(', ');
            const results = await fetchUpcomingEventSuggestions({
                locationLabel,
                tagIds: primary.route.tag_ids || [],
                limit: 20,
            });
            setSuggestedEvents(results);
            // REMOVED: setSelectedEventIds([]); which cleared your choices!
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unable to load event suggestions right now.';
            showError('Event Suggestions Unavailable', message);
        } finally {
            setLoadingEvents(false);
        }
    }, [cityLabel, primary]);

    useEffect(() => {
        loadEventSuggestions();
    }, [loadEventSuggestions]);

    const resetToCreateTour = useCallback(() => {
        bypassGuardRef.current = true;
        navigation.dispatch(
            CommonActions.reset({
                index: 1,
                routes: [{ name: 'MyTour' }, { name: 'CreateTour' }],
            })
        );
    }, [navigation]);

    const showDiscardAlert = useCallback((onDiscard: () => void, onStay?: () => void) => {
        CustomAlert.alert(
            'Discard Tour?',
            "You haven't saved this tour. Leaving will discard it and you'll need to create it again.",
            [
                {
                    text: 'Stay',
                    style: 'cancel',
                    onPress: onStay,
                },
                {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: onDiscard,
                },
            ]
        );
    }, []);

    const removePlace = async (placeId: string) => {
        const removedPlace = places.find((place) => place.id === placeId);
        if (!removedPlace) return;

        const nextPlaces = places.filter((place) => place.id !== placeId);
        setPlaces(nextPlaces);

        if (!userId || !primary || !existingTourId) {
            showSuccess('Location removed', `${removedPlace.name} was removed from your tour.`);
            return;
        }

        try {
            if (isFavorite(placeId)) {
                await removeFromFavorites(placeId, 'Place');
            }
            await removeTourPlaceFromUserAndRecord({
                userId,
                tourId: existingTourId,
                placeId,
            });

            setPlaces(nextPlaces);

            console.log('DEBUG TourSuggestion - removePlace - selectedEvents:', selectedEvents);
            const allPlacesAndEvents = [
                ...nextPlaces.map((p, idx) => ({
                    place_id: p.id,
                    visited: false,
                    visitedAt: null,
                    pointsEarned: 0,
                    proofImageUri: null,
                    addedByUser: false,
                    order: idx + 1,
                })),
                ...selectedEvents.map((e, idx) => ({
                    event_id: e.id,
                    visited: false,
                    visitedAt: null,
                    pointsEarned: 0,
                    proofImageUri: null,
                    addedByUser: false,
                    order: nextPlaces.length + idx + 1,
                })),
            ];

            await saveUserTour({
                tourId: existingTourId,
                userId,
                userName: authUser?.name || '',
                userEmail: authUser?.email || '',
                route: primary.route,
                title: tourNameState,
                places: nextPlaces,
                events: selectedEvents,
                placeProgress: {},
                currentStopIndex: 0,
                isEdited: true,
                status: 'saved',
                scheduledDate: null,
                navigableRoute: buildSuggestedNavigableRoute(
                    nextPlaces,
                    selectedEvents
                ),
                allPlacesAndEvents,
            });
            showSuccess('Location removed', `${removedPlace.name} was removed from your tour.`);
        } catch {
            showError('Remove Failed', 'Unable to remove this location from your tour.');
        }
    };

    useEffect(() => {
        const addedPlaceId = params?.addedPlaceId;
        if (!addedPlaceId) return;

        fetchPlacesByIds([addedPlaceId]).then((fetchedPlaces) => {
            const addedPlace = fetchedPlaces[0];
            if (!addedPlace) return;
            setPlaces((prev) => {
                if (prev.some((place) => place.id === addedPlace.id)) return prev;
                return [...prev, addedPlace];
            });
        });
        navigation.setParams({ addedPlaceId: undefined, timestamp: undefined });
    }, [navigation, params?.addedPlaceId, params?.timestamp]);

    const toggleLocationDetails = (placeId: string) => {
        setExpandedLocations((prev) => ({
            ...prev,
            [placeId]: !prev[placeId],
        }));
    };

    useEffect(() => {
        navigation.setParams({ hasUnsavedChanges: !saved });
    }, [navigation, saved]);

    useEffect(() => {
        navigation.setOptions({
            gestureEnabled: saved,
            headerBackButtonMenuEnabled: false,
        });
    }, [navigation, saved]);

    const handlePreventRemove = useCallback((event: any) => {
        if (saved || bypassGuardRef.current) return;

        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }

        showDiscardAlert(
            () => {
                bypassGuardRef.current = true;
                const action = event?.data?.action;
                if (action) {
                    navigation.dispatch(action);
                } else {
                    navigation.goBack();
                }
            },
            () => {
                bypassGuardRef.current = false;
            }
        );
    }, [navigation, saved, showDiscardAlert]);

    usePreventRemove(!saved, handlePreventRemove);

    useEffect(() => {
        const ancestors = [
            navigation.getParent(),
            navigation.getParent()?.getParent(),
            navigation.getParent()?.getParent()?.getParent(),
        ].filter((ancestor): ancestor is NonNullable<typeof ancestor> => Boolean(ancestor));
        if (ancestors.length === 0) return;

        const unsubscribers = ancestors.map((ancestor) =>
            ancestor.addListener('tabPress' as any, (event: any) => {
                if (saved || bypassGuardRef.current) return;
                const state = ancestor.getState();
                const targetRoute = state.routes.find((item) => item.key === event.target);
                const isTabNavigator = state.routes.some((item) => TAB_ROUTE_NAMES.has(item.name));
                if (!isTabNavigator || !targetRoute || targetRoute.name === 'MyTours') return;

                event.preventDefault();
                showDiscardAlert(() => {
                    resetToCreateTour();
                    requestAnimationFrame(() => {
                        ancestor.navigate(targetRoute.name as never);
                    });
                });
            })
        );
        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [navigation, resetToCreateTour, saved, showDiscardAlert]);

    const handleSave = async () => {
        if (!userId || recommendations.length === 0 || !primary) {
            navigation.goBack();
            return;
        }
        setSaving(true);
        const now = new Date().toISOString();
        try {
            const selectedEventsToSave = [...selectedEvents];
            console.log('DEBUG TourSuggestion - selectedEvents before save:', selectedEvents);
            console.log('DEBUG TourSuggestion - selectedEventIds:', selectedEventIds);
            console.log('DEBUG TourSuggestion - allAvailableEvents:', allAvailableEvents);
            const allPlacesAndEvents = [
                ...places.map((p, idx) => ({
                    place_id: p.id,
                    visited: false,
                    visitedAt: null,
                    pointsEarned: 0,
                    proofImageUri: null,
                    addedByUser: false,
                    order: idx + 1,
                })),
                ...selectedEventsToSave.map((e, idx) => ({
                    event_id: e.id,
                    visited: false,
                    visitedAt: null,
                    pointsEarned: 0,
                    proofImageUri: null,
                    addedByUser: false,
                    order: places.length + idx + 1,
                })),
            ];

            await saveUserTour({
                tourId: existingTourId,
                userId,
                userName: authUser?.name || '',
                userEmail: authUser?.email || '',
                route: primary.route,
                title: tourNameState,
                places,
                events: selectedEventsToSave,
                placeProgress: {},
                currentStopIndex: 0,
                isEdited: places.length !== initialPlaces.length || selectedEventsToSave.length > 0,
                status: 'saved',
                scheduledDate: null,
                navigableRoute: buildSuggestedNavigableRoute(
                    places,
                    selectedEventsToSave
                ),
                allPlacesAndEvents,
            });

            // events are now embedded in all_places; no need for separate write

            setSaved(true);
            bypassGuardRef.current = true;

            navigation.navigate('MyTour', {
                pendingCreate: {
                    status: 'saved',
                    scheduledDate: null,
                    createdAt: now,
                    tourName: tourNameState,
                    recommendations: [{ ...primary, places, events: selectedEventsToSave }],
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save this tour right now.';
            showError('Save Failed', message);
        } finally {
            setSaving(false);
        }
    };

    if (recommendations.length === 0) {
        return (
            <View style={styles.container}>
                <TopHeader title="My Tour" />
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>No suggestions available.</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <TopHeader title="My Tour" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.tourCard}>
                    <View style={styles.cardTop}>
                        <Image source={{ uri: previewImage }} style={styles.thumb} />
                        <View style={styles.cardInfo}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.leftTitleRow}>
                                    <Text style={styles.tourTitle} numberOfLines={1}>{tourNameState}</Text>
                                    <TouchableOpacity onPress={() => setNameModalVisible(true)} hitSlop={8} style={styles.editIconWrap}>
                                        <EditProfileIcon width={18} height={18} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.topIcons}>
                                    <IconUp width={16} height={16} />
                                </View>
                            </View>
                            <View style={styles.iconInfoRow}>
                                <View style={styles.iconTextGroup}>
                                    <TourLocationIcon width={20} height={20} />
                                    <Text style={styles.textInfo}>Visit {places.length} Locations</Text>
                                </View>
                                {dateLabel ? (
                                    <View style={styles.iconTextGroup}>
                                        <TourDateIcon width={20} height={20} />
                                        <Text style={styles.textInfo}>{dateLabel}</Text>
                                    </View>
                                ) : null}
                            </View>
                            <View style={styles.iconInfoRow}>
                                <View style={styles.iconTextGroup}>
                                    <EarnedPointIcon width={20} height={20} />
                                    <Text style={styles.textInfo}>
                                        Earn <Text style={styles.pointsValue}>+{totalPoints}</Text> Points
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View style={styles.cardBottom}>
                        <View style={styles.locationHeader}>
                            <Text style={styles.locationTitle}>Locations</Text>
                            <TouchableOpacity
                                style={styles.addLocBtn}
                                onPress={() =>
                                    navigation.navigate('AddLocations', {
                                        routeId: primary?.route?.id,
                                        cityLabel,
                                        fromScreen: 'TourSuggestion',
                                        existingPlaceIds: places.map((place) => place.id),
                                    })
                                }
                            >
                                <IconPlus width={11} height={11} />
                                <Text style={styles.addLocation}>Add Locations</Text>
                            </TouchableOpacity>
                        </View>
                        {places.map((place) => {
                            const isExpanded = Boolean(expandedLocations[place.id]);
                            const hasDetails = Boolean(place.address || place.description);
                            return (
                                <View key={place.id} style={styles.locationCard}>
                                    <View style={styles.locationRow}>
                                        <View style={styles.locationLeft}>
                                            <CreatedTourLocationIcon width={20} height={20} />
                                            <Text style={styles.locationText}>{place.name}</Text>
                                        </View>
                                        <View style={styles.locationActions}>
                                            {hasDetails ? (
                                                <TouchableOpacity
                                                    onPress={() => toggleLocationDetails(place.id)}
                                                    hitSlop={8}
                                                    style={styles.locationToggle}
                                                >
                                                    {isExpanded ? <IconUp width={16} height={16} /> : <DownArrow width={16} height={16} />}
                                                </TouchableOpacity>
                                            ) : null}
                                            <TouchableOpacity onPress={() => removePlace(place.id)} hitSlop={8} style={styles.deleteBtn}>
                                                <IconDelete width={15} height={15} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {isExpanded && (
                                        <View style={styles.locationDetails}>
                                            {place.address && <Text style={styles.locationMetaText}>{place.address}</Text>}
                                            {place.description && <Text style={styles.locationDescription}>{place.description}</Text>}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                        <View style={styles.disclaimerBox}>
                            <Text style={styles.disclaimerTitle}>Event Selection</Text>
                            <Text style={styles.disclaimerText}>
                                Select events from the next 3 months to include in this tour.
                                Selected events will appear during the tour at their scheduled day and time.
                            </Text>
                        </View>
                        {selectedEvents.length > 0 && (
                            <>
                                <View style={styles.eventsSectionHeader}>
                                    <Text style={styles.eventsTitle}>Events</Text>
                                    <Text style={styles.eventCountText}>{selectedEvents.length} selected</Text>
                                </View>
                                <View style={styles.selectedEventsList}>
                                    {selectedEvents.map((event) => {
                                        const eventDate = event.startDate ? new Date(event.startDate).toLocaleDateString() : '';
                                        const eventTime = event.startTime || '';
                                        return (
                                            <View key={event.id} style={styles.selectedEventCard}>
                                                <View style={styles.selectedEventContent}>
                                                    <CreatedTourLocationIcon width={20} height={20} />
                                                    <View style={styles.selectedEventInfo}>
                                                        <Text style={styles.locationText} numberOfLines={1}>{event.title}</Text>
                                                        <Text style={styles.selectedEventMeta}>
                                                            {eventDate}
                                                            {eventTime ? ` • ${eventTime}` : ''}
                                                            {event.city_name ? ` • ${event.city_name}` : ''}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity onPress={() => removeSelectedEvent(event.id)} hitSlop={8} style={styles.deleteBtn}>
                                                        <IconDelete width={18} height={18} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </>
                        )}
                        <View style={styles.eventsSectionHeader}>
                            <Text style={styles.eventsTitle}>Event Suggestions</Text>
                            {availableSuggestions.length > 0 && (
                                <TouchableOpacity onPress={removeAllSuggestions}>
                                    <Text style={styles.clearAllText}>Clear all</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {loadingEvents ? (
                            <ActivityIndicator color={COLORS.BUTTON_COLOR} />
                        ) : availableSuggestions.length === 0 ? (
                            <Text style={styles.noEventsText}>
                                {selectedEvents.length > 0 ? 'No more event suggestions available.' : 'No upcoming event suggestions available.'}
                            </Text>
                        ) : (
                            <View style={styles.eventList}>
                                {availableSuggestions.map((event) => {
                                    const isExpanded = Boolean(expandedLocations[event.id]);
                                    const eventDate = event.startDate ? new Date(event.startDate).toLocaleDateString() : '';
                                    const eventTime = event.startTime || '';
                                    const hasDetails = Boolean(event.description || event.city_name || eventDate);
                                    return (
                                        <View key={event.id} style={styles.locationCard}>
                                            <View style={styles.locationRow}>
                                                <View style={styles.locationLeft}>
                                                    <CreatedTourLocationIcon width={20} height={20} />
                                                    <View style={styles.selectedEventInfo}>
                                                        <Text style={styles.locationText} numberOfLines={1}>{event.title}</Text>
                                                        <Text style={styles.selectedEventMeta}>
                                                            {eventDate}
                                                            {eventTime ? ` • ${eventTime}` : ''}
                                                            {event.city_name ? ` • ${event.city_name}` : ''}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={styles.locationActions}>
                                                    {hasDetails && (
                                                        <TouchableOpacity
                                                            onPress={() => toggleLocationDetails(event.id)}
                                                            hitSlop={8}
                                                            style={styles.locationToggle}
                                                        >
                                                            {isExpanded ? <IconUp width={16} height={16} /> : <DownArrow width={16} height={16} />}
                                                        </TouchableOpacity>
                                                    )}
                                                    <TouchableOpacity style={styles.addEventBtn} onPress={() => toggleEventSelection(event.id)} activeOpacity={0.8}>
                                                        {/* <IconPlus width={10} height={10} /> */}
                                                        <Text style={{color: COLORS.BUTTON_COLOR}}>+</Text>
                                                        <Text style={styles.addEventText}>Add</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => removeEventSuggestion(event.id)} hitSlop={8} style={styles.deleteBtn}>
                                                        {/* <CloseIcon width={15} height={15} /> */}
                                                        <Text style={{color: COLORS.LOGOUT_TEXT}}>x</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            {isExpanded && (
                                                <View style={styles.locationDetails}>
                                                    {event.description && <Text style={styles.locationDescription}>{event.description}</Text>}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
            <NameTourModal
                visible={nameModalVisible}
                tourName={tourNameState}
                setTourName={setTourNameState}
                onClose={() => setNameModalVisible(false)}
                onConfirm={(nextName) => {
                    setTourNameState(nextName);
                    setNameModalVisible(false);
                }}
                onUpdateLater={() => setNameModalVisible(false)}
            />
            <View style={styles.footer}>
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving || places.length === 0}
                >
                    {saving ? <ActivityIndicator color={COLORS.WHITE} /> : <Text style={styles.saveText}>Save Tour</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
};
export default TourSuggestion;

const styles = StyleSheet.create({
    addEventBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        // backgroundColor:COLORS.BUTTON_DISABLED,
        backgroundColor:'#cde6fc',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 5,
    },

    addEventText: {
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        color: COLORS.BUTTON_COLOR,
    },
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        color: COLORS.TEXT_SECONDARY,
    },
    scrollContent: {
        paddingHorizontal: 23,
        paddingTop: 20,
        paddingBottom: 120,
    },
    tourCard: {
        width: '100%',
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
        justifyContent: 'space-between',
    },
    thumb: {
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
    tourTitle: {
        flex: 1,
        fontSize: FONT_SIZE.SMALL_TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },
    leftTitleRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    editIconWrap: {
        marginLeft: 8,
        padding: 6,
        borderRadius: 16,
        backgroundColor: 'transparent',
    },
    topIcons: {
        height: 20,
        width: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
        gap: 12,
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
    pointsValue: {
        color: COLORS.TEXT_GREEN,
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
    deleteBtn: {
        marginLeft: 12,
    },
    locationCard: {
        paddingVertical: 6,
    },
    locationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    locationLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    locationText: {
        flex: 1,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_PRIMARY,
    },
    locationActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // backgroundColor:'red'
        // gap: 12,
    },
    locationToggle: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 5,
    },
    locationDetails: {
        marginTop: 8,
        marginLeft: 29,
        gap: 4,
    },
    locationMetaText: {
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        color: COLORS.TEXT_PRIMARY,
        lineHeight: 18,
    },
    locationDescription: {
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
        lineHeight: 18,
    },
    selectedEventsList: {
        marginBottom: 16,
        gap: 10,
    },
    selectedEventCard: {
        // padding: 14,
        borderRadius: 14,
    },
    selectedEventContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    selectedEventInfo: {
        flex: 1,
    },
    selectedEventName: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
        marginBottom: 4,
    },
    selectedEventMeta: {
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
    },
    eventsTitle: {
        marginTop: 10,
        marginBottom: 6,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },
    eventCountText: {
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
    },
    disclaimerBox: {
        marginTop: 6,
        padding: 10,
        borderRadius: 14,
        backgroundColor: '#EEF6FF',
        borderWidth: 1,
        borderColor: '#D0E6FB',
    },
    disclaimerTitle: {
        fontSize: FONT_SIZE.SMALL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        color: COLORS.TEXT_PRIMARY,
        marginBottom: 8,
    },
    disclaimerText: {
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
        lineHeight: 18,
        marginBottom: 4,
    },
    eventsSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    clearAllText: {
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        color: COLORS.LOGOUT_TEXT,
    },
    noEventsText: {
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
        marginTop: 8,
    },
    eventList: {
        gap: 10,
    },
    eventCard: {
        padding: 14,
        borderRadius: 14,
        backgroundColor: COLORS.WHITE,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    eventRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
    },
    eventName: {
        flex: 1,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },
    eventMeta: {
        marginTop: 6,
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
    },
    eventDescription: {
        marginTop: 6,
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
        lineHeight: 18,
    },
    eventSelectedLabel: {
        marginTop: 8,
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        color: COLORS.BUTTON_COLOR,
    },
    eventUnselectedLabel: {
        marginTop: 8,
        fontSize: FONT_SIZE.PILL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        color: COLORS.TEXT_SECONDARY,
    },
    saveBtn: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 14,
        backgroundColor: COLORS.BUTTON_COLOR,
        alignItems: 'center',
    },
    saveBtnDisabled: {
        opacity: 0.5,
    },
    saveText: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.WHITE,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 23,
        paddingVertical: 16,
        backgroundColor: COLORS.WHITE,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
});
