import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TopHeader from '../../components/Home/TopHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import {
    EventIcon, FavoriteScreenIcon, FoodTabIcon,
    ForkIcon, MusicTabIcon, MapIconMain
} from '../../constants/icons';
import PlacesArroundCard from '../../components/Home/PlacesArroundCard';
import CustomTabs from '../../components/common/CustomTabs';
import { useFavorites, FavoriteItem } from '../../context/FavoritesContext';
const Favorites = () => {
    const { favorites } = useFavorites();
    const navigation = useNavigation<any>();
    const [activeTab, setActiveTab] = useState('All');

    const tabs = [
        { label: 'All', value: 'All' },
        { label: 'Food', value: 'Food', icon: <FoodTabIcon width={15.53} height={15.53} /> },
        { label: 'Restaurant', value: 'Restaurant', icon: <ForkIcon width={16} height={16} /> },
        { label: 'Music', value: 'Music', icon: <MusicTabIcon width={16} height={16} /> },
        { label: 'Event', value: 'Event', icon: <EventIcon width={16} height={16} /> },
        { label: 'Tours', value: 'Route', icon: <MapIconMain width={16} height={16} /> },
    ];
    const filteredData = activeTab === 'All'
        ? favorites
        : favorites.filter(item => item.category === activeTab);
    const handleNavigate = (item: FavoriteItem) => {
        if (!item.routeName) return;
        if (item.routeName === "MyTourStart") {
            navigation.navigate("MyTour", {
                screen: "MyTourStart",
                params: item.routeParams,
            });
        }
        else if (item.routeName === "PlacesArroundDetails") {
            navigation.navigate("ForYou", {
                screen: "RecommendationDetials",
                params: {
                    item: item,
                },
            });
        }
        else if (item.routeName === "RecommendationDetials") {
            navigation.navigate("ForYou", {
                screen: "RecommendationDetials",
                params: {
                    item: item,
                },
            });
        }
        else {
            navigation.navigate(item.routeName, item.routeParams);
        }
    };
    return (
        <View style={styles.container}>
            <TopHeader title="Favorites" />
            {favorites.length === 0 ? (
                <View style={styles.content}>
                    <FavoriteScreenIcon width={127.71} height={179} />
                    <Text style={styles.title}>Oops! No Favorites Yet</Text>
                    <Text style={styles.desc}>Discover amazing places and events and add them here!</Text>
                    <TouchableOpacity style={styles.btnContainer} onPress={() => navigation.navigate('ForYou')}>
                        <Text style={styles.btn}>Explore Now</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.favoritesContent}>
                    <CustomTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
                    <FlatList
                        data={filteredData}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handleNavigate(item)}
                                activeOpacity={0.9}
                                style={styles.itemWrapper}
                            >
                                <PlacesArroundCard
                                    id={item.id}
                                    title={item.title}
                                    description={item.description}
                                    rating={item.rating}
                                    image={item.image}
                                    category={item.category}
                                />
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={styles.listContent}
                    />
                </View>
            )}
        </View>
    );
};

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
        width: 310
    },

    btn: {
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },

    btnContainer: {
        justifyContent: "center",
        alignItems: "center",
        marginTop: 28,
        backgroundColor: COLORS.BUTTON_COLOR,
        height: 50,
        borderRadius: 40,
        paddingHorizontal: 52,
    },

    listContent: {
        paddingTop: 6,
        paddingBottom: 20
    },

    itemWrapper: {
        marginBottom: 16,
        marginHorizontal: 24
    },
    favoritesContent: {
        flex: 1,
        marginTop: 24,
        gap: 5
    }
})