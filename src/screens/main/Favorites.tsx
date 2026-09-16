import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import TopHeader from '../../components/Home/TopHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import {
    FavoriteScreenIcon,
    PlaceTabIcon,
    PlaceTabIconActive,
    TourTabIcon,
    TourTabIconActive,
} from '../../constants/icons';
import PlacesArroundCard from '../../components/Home/PlacesArroundCard';
import CustomTabs from '../../components/common/CustomTabs';
import { useFavorites } from '../../context/FavoritesContext';
import {
    fetchEventsByIds,
    fetchPlacesByIds,
    fetchToursByIds,
    FirebasePlace,
    SavedTour,
} from '../../services/myTourService';

type TabValue = 'Places' | 'Tours';

type FavoriteTourItem = SavedTour & { coverImage?: string };

const Favorites = () => {
    const { favorites, favoriteTours, favoriteEvents, fallbackPlaceDocs } = useFavorites();
    const navigation = useNavigation<any>();
    const [activeTab, setActiveTab] = useState<TabValue>('Places');
    const [places, setPlaces] = useState<FirebasePlace[]>([]);
    const [tours, setTours] = useState<FavoriteTourItem[]>([]);
    const [loading, setLoading] = useState(true);

    const tabs = [
        {
            label: 'Places',
            value: 'Places',
            icon: <PlaceTabIcon width={16} height={16} />,
            activeIcon: <PlaceTabIconActive width={16} height={16} />,
        },
        {
            label: 'Tours',
            value: 'Tours',
            icon: <TourTabIcon width={16} height={16} />,
            activeIcon: <TourTabIconActive width={16} height={16} />,
        },
    ];

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            console.log('[Favorites] context arrays:', {
                favorites,
                favoriteTours,
                favoriteEvents,
            });
            const [placesData, toursData, eventsData] = await Promise.all([
                fetchPlacesByIds(favorites),
                fetchToursByIds(favoriteTours),
                fetchEventsByIds(favoriteEvents),
            ]);
            console.log('[Favorites] resolved from Firestore:', {
                placesCount: placesData.length,
                toursCount: toursData.length,
                eventsCount: eventsData.length,
                tourIdsFound: toursData.map((t) => t.id),
            });

            const placesById = new Map(placesData.map((p) => [p.id, p]));
            // Merge any fallback place docs stored on the user's document (favoritePlaceDocs)
            const favDocs = fallbackPlaceDocs || {};
            Object.keys(favDocs || {}).forEach((placeId) => {
                try {
                    const doc = favDocs[placeId];
                    if (!doc) return;
                    const placeObj: FirebasePlace = {
                        id: placeId,
                        name: doc.name || '',
                        description: doc.description || doc.address || '',
                        rating: Number(doc.rating || 0),
                        imageUrl: doc.imageUrl || '',
                        address: doc.address || '',
                        city_name: doc.city_name || '',
                        country: doc.country || '',
                        isActive: doc.isActive !== false,
                    } as any;
                    placesById.set(placeId, placeObj);
                } catch {
                    // ignore malformed fallback doc
                }
            });
            const toursById = new Map(toursData.map((t) => [t.id, t]));
            const eventIdsFound = new Set(eventsData.map((e) => e.id));
            const miscategorizedPlaceIds = favoriteEvents.filter(
                (id) => !eventIdsFound.has(id)
            );
            const miscategorizedPlaces =
                miscategorizedPlaceIds.length > 0
                    ? await fetchPlacesByIds(miscategorizedPlaceIds)
                    : [];

            miscategorizedPlaces.forEach((place) => {
                placesById.set(place.id, place);
            });

            const tourPlaceIds = Array.from(
                new Set(
                    toursData.flatMap((tour) =>
                        (tour.all_places || [])
                            .map((item) => item.place_id)
                            .filter((placeId): placeId is string => Boolean(placeId))
                    )
                )
            );
            const tourPlaces =
                tourPlaceIds.length > 0 ? await fetchPlacesByIds(tourPlaceIds) : [];
            const tourPlacesById = new Map(tourPlaces.map((place) => [place.id, place]));

            const placeIds = new Set<string>();
            const mergedPlaces: FirebasePlace[] = [];
            [...favorites, ...miscategorizedPlaceIds].forEach((id) => {
                if (placeIds.has(id)) return;
                const place = placesById.get(id);
                if (!place) return;
                placeIds.add(id);
                mergedPlaces.push(place);
            });
            setPlaces(mergedPlaces);

            setTours(
                favoriteTours
                    .map((id) => toursById.get(id))
                    .filter((t): t is SavedTour => Boolean(t))
                    .map((tour) => {
                        const coverImage =
                            (tour.all_places || [])
                                .map((item) =>
                                    item.place_id
                                        ? tourPlacesById.get(item.place_id)?.imageUrl
                                        : undefined
                                )
                                .find((url): url is string => Boolean(url)) || '';
                        return { ...tour, coverImage };
                    })
            );
        } catch (err) {
            console.warn('[Favorites] failed to load', err);
        } finally {
            setLoading(false);
        }
    }, [favorites, favoriteTours, favoriteEvents, fallbackPlaceDocs]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    useFocusEffect(
        useCallback(() => {
            loadAll();
        }, [loadAll])
    );

    const totalCount = places.length + tours.length;

    const handlePlaceTap = (place: FirebasePlace) => {
        navigation.navigate('ForYou', {
            screen: 'RecommendationDetials',
            params: {
                item: {
                    id: place.id,
                    title: place.name,
                    description: place.description || place.address || '',
                    rating: String(place.rating || ''),
                    image: place.imageUrl || '',
                    category: 'Food',
                },
            },
        });
    };

    const handleTourTap = (tour: SavedTour) => {
        navigation.navigate('MyTours', {
            screen: 'MyTourStart',
            params: {
                routeId: tour.route_id,
                tourId: tour.id,
                tourName: tour.title,
                cityLabel: [tour.city_name, tour.country].filter(Boolean).join(', '),
            },
        });
    };

    const renderPlaceItem = ({ item }: { item: FirebasePlace }) => (
        <TouchableOpacity
            onPress={() => handlePlaceTap(item)}
            activeOpacity={0.9}
            style={styles.itemWrapper}
        >
            <PlacesArroundCard
                id={item.id}
                title={item.name}
                description={item.description || item.address || 'Location'}
                rating={String(item.rating || 0)}
                image={item.imageUrl || ''}
                location={[item.city_name, item.country].filter(Boolean).join(', ')}
                // In Favorites places view we hide the green time label
                hideTime
                category="Place"
            />
        </TouchableOpacity>
    );

    const renderTourItem = ({ item }: { item: FavoriteTourItem }) => (
        <TouchableOpacity
            onPress={() => handleTourTap(item)}
            activeOpacity={0.9}
            style={styles.itemWrapper}
        >
            <PlacesArroundCard
                id={item.id}
                title={item.title || 'My Tour'}
                description={[item.city_name, item.country].filter(Boolean).join(', ') || 'Tour'}
                image={item.coverImage || ''}
                location={[item.city_name, item.country].filter(Boolean).join(', ')}
                category="Route"
                // For favorite tours hide rating, time and bottom location/underline
                hideRating
                hideTime
                hideLocation
                hideDivider
            />
        </TouchableOpacity>
    );

    const renderActiveTab = () => {
        if (loading) {
            return (
                <View style={styles.content}>
                    <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
                </View>
            );
        }

        if (activeTab === 'Places') {
            if (places.length === 0) {
                return <EmptyMessage text="No favorite places yet" />;
            }
            return (
                <FlatList
                    data={places}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPlaceItem}
                    contentContainerStyle={styles.listContent}
                />
            );
        }

        if (tours.length === 0) {
            return <EmptyMessage text="No favorite tours yet" />;
        }
        return (
            <FlatList
                data={tours}
                keyExtractor={(item) => item.id}
                renderItem={renderTourItem}
                contentContainerStyle={styles.listContent}
            />
        );
    };

    return (
        <View style={styles.container}>
            <TopHeader title="Favorites" />
            {!loading && totalCount === 0 ? (
                <View style={styles.content}>
                    <FavoriteScreenIcon width={127.71} height={179} />
                    <Text style={styles.title}>Oops! No Favorites Yet</Text>
                    <Text style={styles.desc}>
                        Discover amazing places and tours and add them here!
                    </Text>
                    <TouchableOpacity
                        style={styles.btnContainer}
                        onPress={() => navigation.navigate('ForYou')}
                    >
                        <Text style={styles.btn}>Explore Now</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.favoritesContent}>
                    <CustomTabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onChange={(value: string) => setActiveTab(value as TabValue)}
                    />
                    {renderActiveTab()}
                </View>
            )}
        </View>
    );
};

const EmptyMessage = ({ text }: { text: string }) => (
    <View style={styles.content}>
        <FavoriteScreenIcon width={127.71} height={179} />
        <Text style={styles.title}>{text}</Text>
    </View>
);

export default Favorites;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.BACKGROUND,
    },

    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },

    title: {
        marginTop: 24,
        fontSize: FONT_SIZE.LARGE_TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },

    desc: {
        marginTop: 12,
        textAlign: 'center',
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
        lineHeight: 20,
        width: 310,
    },

    btn: {
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },

    btnContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 28,
        backgroundColor: COLORS.BUTTON_COLOR,
        height: 50,
        borderRadius: 40,
        paddingHorizontal: 52,
    },

    listContent: {
        paddingTop: 6,
        paddingBottom: 20,
    },

    itemWrapper: {
        marginBottom: 16,
        marginHorizontal: 24,
    },
    favoritesContent: {
        flex: 1,
        marginTop: 24,
        gap: 5,
    },
});
