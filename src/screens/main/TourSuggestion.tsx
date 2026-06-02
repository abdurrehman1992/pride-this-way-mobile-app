import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
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
} from '../../constants/icons';
import { showError } from '../../components/common/AppToast';
import { MyTourStackParamList } from '../../types/types';
import { RootState } from '../../Redux/store';
import {
    FirebasePlace,
    fetchPlacesByIds,
    RecommendedRoute,
    saveUserTour,
} from '../../services/myTourService';

type NavigationProp = NativeStackNavigationProp<MyTourStackParamList, 'TourSuggestion'>;

const POINTS_PER_LOCATION = 15;
const TAB_ROUTE_NAMES = new Set(['MyTours', 'Map', 'ForYou', 'Favorites']);

const TourSuggestion: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<any>();
    const authUser = useSelector((state: RootState) => state.auth.user);
    const userId = authUser?.id;

    const params = route.params as {
        tourName?: string;
        cityLabel?: string;
        recommendations?: RecommendedRoute[];
        addedPlaceId?: string;
        timestamp?: number;
    } | undefined;

    const recommendations = params?.recommendations || [];
    const tourName = params?.tourName || recommendations[0]?.route?.name || 'Custom Tour';
    const cityLabel = params?.cityLabel || '';
    const primary = recommendations[0];
    const initialPlaces: FirebasePlace[] = primary?.places || [];
    const events = primary?.events || [];

    const [places, setPlaces] = useState<FirebasePlace[]>(initialPlaces);
    const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});

    const totalPoints = useMemo(() => places.length * POINTS_PER_LOCATION, [places.length]);

    const previewImage =
        places[0]?.imageUrl ||
        primary?.favoritePlace?.imageUrl ||
        events[0]?.coverImage ||
        '';

    const dateLabel = primary?.route?.dateRange?.startDate;

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const bypassGuardRef = useRef(false);

    const resetToCreateTour = useCallback(() => {
        bypassGuardRef.current = true;
        navigation.dispatch(
            CommonActions.reset({
                index: 1,
                routes: [{ name: 'MyTour' }, { name: 'CreateTour' }],
            })
        );
    }, [navigation]);

    const showDiscardAlert = useCallback((onDiscard: () => void) => {
        Alert.alert(
            'Discard Tour?',
            "You haven't saved this tour. Leaving will discard it and you'll need to create it again.",
            [
                { text: 'Stay', style: 'cancel' },
                {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: onDiscard,
                },
            ]
        );
    }, []);

    const removePlace = (placeId: string) => {
        setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    };

    useEffect(() => {
        const addedPlaceId = params?.addedPlaceId;
        if (!addedPlaceId) {
            return;
        }

        fetchPlacesByIds([addedPlaceId]).then((fetchedPlaces) => {
            const addedPlace = fetchedPlaces[0];
            if (!addedPlace) {
                return;
            }

            setPlaces((prev) => {
                if (prev.some((place) => place.id === addedPlace.id)) {
                    return prev;
                }

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
        const unsubscribe = navigation.addListener('beforeRemove', (event) => {
            if (saved || bypassGuardRef.current) return;
            event.preventDefault();
            showDiscardAlert(() => {
                bypassGuardRef.current = true;
                navigation.dispatch(event.data.action);
            });
        });
        return unsubscribe;
    }, [navigation, saved, showDiscardAlert]);

    useEffect(() => {
        const ancestors = [
            navigation.getParent(),
            navigation.getParent()?.getParent(),
            navigation.getParent()?.getParent()?.getParent(),
        ].filter(Boolean);

        if (ancestors.length === 0) {
            return;
        }

        const unsubscribers = ancestors.map((ancestor) =>
            ancestor.addListener('tabPress', (event) => {
                if (saved || bypassGuardRef.current) return;

                const state = ancestor.getState();
                const targetRoute = state.routes.find((item) => item.key === event.target);
                const isTabNavigator = state.routes.some((item) => TAB_ROUTE_NAMES.has(item.name));

                if (!isTabNavigator || !targetRoute || targetRoute.name === 'MyTours') {
                    return;
                }

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
            await saveUserTour({
                tourId: null,
                userId,
                userName: authUser?.name || '',
                userEmail: authUser?.email || '',
                route: primary.route,
                title: tourName,
                places,
                events: primary.events,
                placeProgress: {},
                currentStopIndex: 0,
                isEdited: places.length !== initialPlaces.length,
                status: 'saved',
                scheduledDate: null,
            });

            setSaved(true);
            bypassGuardRef.current = true;
            navigation.navigate('MyTour', {
                pendingCreate: {
                    status: 'saved',
                    scheduledDate: null,
                    createdAt: now,
                    tourName,
                    recommendations: [{ ...primary, places }],
                },
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unable to save this tour right now.';
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

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.tourCard}>
                    <View style={styles.cardTop}>
                        <Image source={{ uri: previewImage }} style={styles.thumb} />
                        <View style={styles.cardInfo}>
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.tourTitle}>{tourName}</Text>
                                <View style={styles.topIcons}>
                                    <IconUp width={16} height={16} />
                                </View>
                            </View>

                            <View style={styles.iconInfoRow}>
                                <View style={styles.iconTextGroup}>
                                    <TourLocationIcon width={20} height={20} />
                                    <Text style={styles.textInfo}>
                                        Visit {places.length} Locations
                                    </Text>
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
                                                    {isExpanded ? (
                                                        <IconUp width={16} height={16} />
                                                    ) : (
                                                        <DownArrow width={16} height={16} />
                                                    )}
                                                </TouchableOpacity>
                                            ) : null}
                                            <TouchableOpacity
                                                onPress={() => removePlace(place.id)}
                                                hitSlop={8}
                                            >
                                                <IconDelete width={15} height={15} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {isExpanded ? (
                                        <View style={styles.locationDetails}>
                                            {place.address ? (
                                                <Text style={styles.locationMetaText}>
                                                    {place.address}
                                                </Text>
                                            ) : null}
                                            {place.description ? (
                                                <Text style={styles.locationDescription}>
                                                    {place.description}
                                                </Text>
                                            ) : null}
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })}

                        {events.length > 0 ? (
                            <>
                                <Text style={styles.eventsTitle}>Events</Text>
                                {events.map((event) => (
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
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving || places.length === 0}
                >
                    {saving ? (
                        <ActivityIndicator color={COLORS.WHITE} />
                    ) : (
                        <Text style={styles.saveText}>Save Tour</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default TourSuggestion;

const styles = StyleSheet.create({
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
        alignItems: 'center',
        gap: 12,
    },
    locationToggle: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
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
    eventsTitle: {
        marginTop: 10,
        marginBottom: 6,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 26,
        backgroundColor: '#F9F9F9',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#ECECEC',
    },
    saveBtn: {
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.BUTTON_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.BUTTON_COLOR,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4,
    },
    saveBtnDisabled: {
        opacity: 0.7,
    },
    saveText: {
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },
});
