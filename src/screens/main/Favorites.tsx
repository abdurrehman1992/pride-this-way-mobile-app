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
    EventIcon,
    FavoriteScreenIcon,
    MapIconMain,
} from '../../constants/icons';
import PlacesArroundCard from '../../components/Home/PlacesArroundCard';
import CustomTabs from '../../components/common/CustomTabs';
import { useFavorites } from '../../context/FavoritesContext';
import {
    fetchEventsByIds,
    fetchPlacesByIds,
    fetchToursByIds,
    FirebaseEvent,
    FirebasePlace,
    SavedTour,
} from '../../services/myTourService';

type TabValue = 'Places' | 'Tours' | 'Events';

type FavoriteTourItem = SavedTour & { coverImage?: string };

const Favorites = () => {
    const { favorites, favoriteTours, favoriteEvents } = useFavorites();
    const navigation = useNavigation<any>();
    const [activeTab, setActiveTab] = useState<TabValue>('Places');
    const [places, setPlaces] = useState<FirebasePlace[]>([]);
    const [tours, setTours] = useState<FavoriteTourItem[]>([]);
    const [events, setEvents] = useState<FirebaseEvent[]>([]);
    const [loading, setLoading] = useState(false);

    const tabs = [
        { label: 'Places', value: 'Places' },
        {
            label: 'Tours',
            value: 'Tours',
            icon: <MapIconMain width={16} height={16} />,
        },
        {
            label: 'Events',
            value: 'Events',
            icon: <EventIcon width={16} height={16} />,
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
            const toursById = new Map(toursData.map((t) => [t.id, t]));
            const eventsById = new Map(eventsData.map((e) => [e.id, e]));

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
                        (tour.all_places || []).map((item) => item.place_id)
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
                                .map((item) => tourPlacesById.get(item.place_id)?.imageUrl)
                                .find((url): url is string => Boolean(url)) || '';
                        return { ...tour, coverImage };
                    })
            );
            setEvents(
                favoriteEvents
                    .map((id) => eventsById.get(id))
                    .filter((e): e is FirebaseEvent => Boolean(e))
            );
        } catch (err) {
            console.warn('[Favorites] failed to load', err);
        } finally {
            setLoading(false);
        }
    }, [favorites, favoriteTours, favoriteEvents]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    useFocusEffect(
        useCallback(() => {
            loadAll();
        }, [loadAll])
    );

    const totalCount = favorites.length + favoriteTours.length + favoriteEvents.length;

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

    const renderEventItem = ({ item }: { item: FirebaseEvent }) => (
        <TouchableOpacity
            onPress={() => navigation.navigate('ForYou', {
                screen: 'RecommendationDetials',
                params: {
                    item: {
                        id: item.id,
                        title: item.title,
                        description: item.description || item.address || '',
                        rating: String(item.rating || ''),
                        image: item.coverImage || '',
                        category: 'Event',
                    },
                },
            })}
            activeOpacity={0.9}
            style={styles.itemWrapper}
        >
            <PlacesArroundCard
                id={item.id}
                title={item.title}
                description={item.description || item.address || 'Event'}
                rating={String(item.rating || '')}
                image={item.coverImage || ''}
                location={[item.city_name, item.country].filter(Boolean).join(', ')}
                category="Event"
                time={item.startTime}
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

        if (activeTab === 'Tours') {
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
        }

        if (events.length === 0) {
            return <EmptyMessage text="No favorite events yet" />;
        }
        return (
            <FlatList
                data={events}
                keyExtractor={(item) => item.id}
                renderItem={renderEventItem}
                contentContainerStyle={styles.listContent}
            />
        );
    };

    return (
        <View style={styles.container}>
            <TopHeader title="Favorites" />
            {totalCount === 0 ? (
                <View style={styles.content}>
                    <FavoriteScreenIcon width={127.71} height={179} />
                    <Text style={styles.title}>Oops! No Favorites Yet</Text>
                    <Text style={styles.desc}>
                        Discover amazing places and events and add them here!
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
