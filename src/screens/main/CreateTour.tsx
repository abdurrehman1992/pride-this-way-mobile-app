import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    const [selectedLocation, setSelectedLocation] = useState('');
    const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [loadingRoutes, setLoadingRoutes] = useState(false);
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

    const clearFlow = () => {
        setSelectedPrefs([]);
        setTourName('');
        setLocationSearch('');
        setSelectedLocation('');
        setLocationSuggestions([]);
    };

    useEffect(() => {
        fetchTourTags()
            .then(setTags)
            .catch(() => setTags([]));
    }, []);

    useEffect(() => {
        if (!modals.location) return;
        if (locationSearch.trim().length < 2) {
            setLocationSuggestions([]);
            setLoadingSuggestions(false);
            return;
        }
        setLoadingSuggestions(true);
        const timeout = setTimeout(() => {
            searchLocationSuggestions(locationSearch)
                .then((results) => setLocationSuggestions(results.map((item) => item.label)))
                .finally(() => setLoadingSuggestions(false));
        }, 350);
        return () => clearTimeout(timeout);
    }, [locationSearch, modals.location]);

    const handleOpenNameModal = async () => {
        setLoadingRoutes(true);
        try {
            const recommendations = await fetchRecommendedRoutes({
                locationLabel: selectedLocation || locationSearch,
                selectedTagIds,
                userId,
            });
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
            const message =
                error instanceof Error ? error.message : 'Unable to load recommendations.';
            showError('Could not load tours', message);
        } finally {
            setLoadingRoutes(false);
        }
    };

    const createTourFromRecommendations = (nameOverride?: string) => {
        const recommendationsSnapshot = pendingRecommendations;
        const tourNameSnapshot = nameOverride?.trim() || recommendationsSnapshot[0]?.route?.name || '';
        const cityLabel =
            [recommendationsSnapshot[0]?.route?.city_name, recommendationsSnapshot[0]?.route?.country]
                .filter(Boolean)
                .join(', ') ||
            selectedLocation ||
            locationSearch;

        closeModal('name');
        setPendingRecommendations([]);
        clearFlow();

        // Defer navigation until after the modal has had a chance to dismiss
        requestAnimationFrame(() => {
            navigation.replace('TourSuggestion', {
                tourName: tourNameSnapshot,
                cityLabel,
                recommendations: recommendationsSnapshot,
            });
        });
    };

    const handleNameConfirm = () => {
        createTourFromRecommendations(tourName);
    };

    const handleUpdateLater = () => {
        createTourFromRecommendations();
    };

    return (
        <View style={styles.container}>
            <TopHeader title="Create New Tour" />

            {loadingRoutes ? (
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
                    <Text style={styles.loaderText}>Finding tours for you…</Text>
                </View>
            ) : (
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
                onUpdateLater={handleUpdateLater}
            />
        </View>
    );
};

export default CreateTour;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
    loaderWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
    },
    loaderText: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        color: COLORS.TEXT_SECONDARY,
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
});
