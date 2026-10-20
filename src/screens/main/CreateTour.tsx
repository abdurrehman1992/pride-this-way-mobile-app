import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import TopHeader from '../../components/Home/TopHeader';
import LocationModal from '../../components/modals/LocationModal';
import PreferenceModal from '../../components/modals/PreferenceModal';
import NameTourModal from '../../components/modals/NameTourModal';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import { MapIconMain, IconPlus } from '../../constants/icons';
import { showError } from '../../components/common/AppToast';
import { CustomAlert } from '../../utils/CustomAlert';
import { MyTourStackParamList } from '../../types/types';
import { RootState } from '../../Redux/store';
import {
    FirebaseTag,
    RecommendedRoute,
    fetchRecommendedRoutes,
    fetchTourTags,
    searchLocationSuggestions,
} from '../../services/myTourService';

type NavigationProp = NativeStackNavigationProp<MyTourStackParamList, 'CreateTour'>;

const CreateTour: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const authUser = useSelector((state: RootState) => state.auth.user);
    const userId = authUser?.id;

    const [modals, setModals] = useState({
        location: false,
        preference: false,
        name: false,
    });
    const [tags, setTags] = useState<FirebaseTag[]>([]);
    const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
    const [tourName, setTourName] = useState('');
    const [locationSearch, setLocationSearch] = useState('');
    const locationQuery = locationSearch.trim().replace(/\s+/g, ' ');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [loadingRoutes, setLoadingRoutes] = useState(false);
    const [transitioningToSuggestion, setTransitioningToSuggestion] = useState(false);
    const routeRequestId = useRef(0);
    const routeRequestInFlight = useRef(false);
    const tourNavigationInFlight = useRef(false);
    const [pendingRecommendations, setPendingRecommendations] = useState<RecommendedRoute[]>([]);

    const tagNames = useMemo(() => tags.map((tag) => tag.name), [tags]);
    const selectedTagIds = useMemo(
        () => tags.filter((tag) => selectedPrefs.includes(tag.name)).map((tag) => tag.id),
        [selectedPrefs, tags]
    );

    const openModal = (key: keyof typeof modals) =>
        setModals((prev) => ({ ...prev, [key]: true }));
    const closeModal = (key: keyof typeof modals) =>
        setModals((prev) => ({ ...prev, [key]: false }));

    const togglePreference = useCallback((item: string) => {
        setSelectedPrefs((prev) =>
            prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
        );
    }, []);

    useEffect(() => {
        fetchTourTags()
            .then(setTags)
            .catch(() => setTags([]));
    }, []);

    useEffect(() => () => { routeRequestId.current += 1; }, []);

    const cancelRouteRequest = () => {
        routeRequestId.current += 1;
        routeRequestInFlight.current = false;
        setLoadingRoutes(false);
    };

    useEffect(() => {
        if (!modals.location) return;
        if (locationQuery.length < 2) {
            setLocationSuggestions([]);
            setLoadingSuggestions(false);
            return;
        }
        let cancelled = false;
        setLoadingSuggestions(true);
        const timeout = setTimeout(() => {
            searchLocationSuggestions(locationQuery)
                .then((results) => {
                    if (!cancelled) setLocationSuggestions(results.map((item) => item.label));
                })
                .catch(() => {
                    if (!cancelled) setLocationSuggestions([]);
                })
                .finally(() => {
                    if (!cancelled) setLoadingSuggestions(false);
                });
        }, 350);
        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [locationQuery, modals.location]);

    const handleOpenNameModal = async () => {
        if (routeRequestInFlight.current) return;
        if (!selectedLocation.trim()) {
            CustomAlert.alert('Please select a location', 'Choose a location first before creating a tour.');
            return;
        }

        if (!selectedPrefs.length) {
            CustomAlert.alert('Select at least one preference', 'Please choose at least one preference before continuing.');
            return;
        }

        const requestId = ++routeRequestId.current;
        routeRequestInFlight.current = true;
        setLoadingRoutes(true);
        try {
            const recommendations = await fetchRecommendedRoutes({
                locationLabel: selectedLocation || locationSearch,
                selectedTagIds,
                userId,
                availableTags: tags,
            });
            if (requestId !== routeRequestId.current) return;
            if (recommendations.length === 0) {
                setPendingRecommendations([]);
                closeModal('preference');
                showError('No Suggestions', 'We couldn\'t find a tour matching that location.');
                return;
            }
            setPendingRecommendations(recommendations);
            const suggestedName = recommendations[0]?.route?.name?.trim();
            setTourName(suggestedName || '');
            closeModal('preference');
            openModal('name');
        } catch (error) {
            if (requestId !== routeRequestId.current) return;
            const message =
                error instanceof Error ? error.message : 'Unable to load recommendations.';
            showError('Could not load tours', message);
        } finally {
            if (requestId === routeRequestId.current) {
                routeRequestInFlight.current = false;
                setLoadingRoutes(false);
            }
        }
    };

    const createTourFromRecommendations = (nameOverride?: string) => {
        if (tourNavigationInFlight.current) return;
        const recommendationsSnapshot = pendingRecommendations;
        if (recommendationsSnapshot.length === 0) return;
        const tourNameSnapshot = nameOverride?.trim() || recommendationsSnapshot[0]?.route?.name || '';
        const cityLabel =
            [recommendationsSnapshot[0]?.route?.city_name, recommendationsSnapshot[0]?.route?.country]
                .filter(Boolean)
                .join(', ') ||
            selectedLocation ||
            locationSearch;

        // Keep a transition screen behind the dismissing native modal so
        // Create New Tour does not flash before TourSuggestion mounts.
        tourNavigationInFlight.current = true;
        setTransitioningToSuggestion(true);
        closeModal('name');
        requestAnimationFrame(() => {
            try {
                navigation.replace('TourSuggestion', {
                    tourName: tourNameSnapshot,
                    cityLabel,
                    recommendations: recommendationsSnapshot,
                    selectedTagIds,
                });
            } catch (error) {
                tourNavigationInFlight.current = false;
                setTransitioningToSuggestion(false);
                openModal('name');
                const message = error instanceof Error ? error.message : 'Unable to open your tour.';
                showError('Could not open tour', message);
            }
        });
    };

    const handleNameConfirm = (nextName?: string) => {
        createTourFromRecommendations(nextName ?? tourName);
    };

    const handleUpdateLater = () => {
        createTourFromRecommendations();
    };

    return (
        <View style={styles.container}>
            <TopHeader title="Create New Tour" />

            <View style={styles.content}>
                <View style={styles.iconHalo}>
                    <MapIconMain width={140} height={90} />
                </View>
                <Text style={styles.tagline}>
                    Plan your next adventure in just a few taps.
                </Text>

                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => openModal('location')}
                    style={styles.cta}
                >
                    <IconPlus width={14} height={14} />
                    <Text style={styles.ctaText}>Select Location</Text>
                </TouchableOpacity>
            </View>

            <LocationModal
                visible={modals.location}
                title="Select Your Location"
                locations={locationSuggestions}
                cityOnlyResults
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
                loading={loadingRoutes}
                preferences={tagNames}
                selectedPrefs={selectedPrefs}
                togglePreference={togglePreference}
                clearAll={() => setSelectedPrefs([])}
                onClose={() => {
                    cancelRouteRequest();
                    closeModal('preference');
                }}
                mode="myTour"
                showTwoButtons
                secondaryLabel="Back"
                primaryLabel="Next"
                onSecondary={() => {
                    cancelRouteRequest();
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
                onConfirm={(nextName) => handleNameConfirm(nextName)}
                onUpdateLater={handleUpdateLater}
            />
            {transitioningToSuggestion ? (
                <View style={styles.transitionOverlay}>
                    <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
                    <Text style={styles.transitionText}>Opening your tour…</Text>
                </View>
            ) : null}
        </View>
    );
};

export default CreateTour;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 60,
    },
    iconHalo: {
        width: 168,
        height: 168,
        borderRadius: 84,
        backgroundColor: COLORS.TABS_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagline: {
        marginTop: 22,
        maxWidth: 300,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        color: COLORS.TEXT_SECONDARY,
        textAlign: 'center',
        lineHeight: 22,
    },
    cta: {
        marginTop: 28,
        paddingHorizontal: 36,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.BUTTON_COLOR,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: COLORS.BUTTON_COLOR,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4,
    },
    ctaText: {
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },
    transitionOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: '#F9F9F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    transitionText: {
        marginTop: 14,
        color: COLORS.TEXT_PRIMARY,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
    },
});
