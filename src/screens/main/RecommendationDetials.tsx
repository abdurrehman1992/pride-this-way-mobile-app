import React from "react";
import {
    View,
    Text,
    ImageBackground,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Share,
    Platform,
} from "react-native";

import { BlurView } from "@react-native-community/blur";
import { useRoute, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
import { DetailBackground } from "../../constants/images";

import CustomButton from "../../components/common/CustomButton";

import {
    DetailsBackIcon,
    DetailsFavoriteIcon,
    DetailsShareIcon,
    DetailsFavoriteWhite,
    ForkIcon,
    StarIcon,
    TimeIcon,
    MiniMapIcon,
    RoofTopIcon,
} from "../../constants/icons";

import { useFavorites } from "../../context/FavoritesContext";
import { showInfo, showSuccess } from "../../components/common/AppToast";

const FALLBACK_IMAGE =
    "https://fastly.picsum.photos/id/1/800/600.jpg?hmac=jH5bDkLr6Tgy3oAg5khKCHeunZMHq0ehBZr6vGifPLY";

const resolveImageSource = (image: any) => {
    if (!image) {
        return DetailBackground;
    }

    if (typeof image === "string") {
        return { uri: image };
    }

    return image;
};

const RecommendationDetials = () => {

    const route = useRoute<any>();
    const navigation = useNavigation();

    const item = route?.params?.item;

    const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();

    if (!item) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            </View>
        );
    }

    const {
        id,
        title = "No Title",
        description = "No Description",
        rating = "4.5",
        image,
        category = "Restaurant",
    } = item;

    const favorite = id ? isFavorite(id) : false;

    const handleFavorite = () => {
        if (!id) return;

        if (favorite) {
            removeFromFavorites(id);
            showInfo("Removed", "Removed from favorites");
        } else {
            addToFavorites({ id, title, description, rating, image, category });
            showSuccess("Added", "Added to favorites");
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `${title}\n\n${description}\n\nRating: ${rating} ⭐`,
                title,
            });
        } catch (e) {
            console.log("Share error:", e);
        }
    };
    const gallery = [
        {
            id: 1,
            name: 'Interior'
        },
        {
            id: 2,
            name: 'Food'
        },
        {
            id: 3,
            name: 'Roof'
        },
    ]
    return (
        <ScrollView style={styles.mainContainer} showsVerticalScrollIndicator={false}>

            {/* ================= HEADER ================= */}
            <ImageBackground
                source={resolveImageSource(image)}
                style={styles.background}
                imageStyle={styles.bgImage}
            >
                <SafeAreaView style={styles.safeArea}>

                    {/* TOP BAR */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <DetailsBackIcon height={43} width={43} />
                        </TouchableOpacity>

                        <View style={styles.rightIcons}>
                            <TouchableOpacity onPress={handleFavorite}>
                                {favorite ? (
                                    <DetailsFavoriteIcon height={43} width={43} />
                                ) : (
                                    <DetailsFavoriteWhite height={43} width={43} />
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleShare}>
                                <DetailsShareIcon height={43} width={43} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ================= GLASS CARD (FIXED FOR ALL DEVICES) ================= */}
                    <View style={styles.topCardContainer}>

                        {/* BLUR ONLY FOR IOS (SAFE) */}
                        {Platform.OS === "ios" ? (
                            <BlurView
                                style={StyleSheet.absoluteFill}
                                blurType="light"
                                blurAmount={15}
                                reducedTransparencyFallbackColor="transparent"
                            />
                        ) : (
                            <View style={styles.androidFallback} />
                        )}

                        {/* DARK OVERLAY */}
                        <View style={styles.overlayTint} />

                        {/* CONTENT */}
                        <View style={styles.cardContent}>

                            <View style={styles.cardTop}>
                                <View style={styles.pill}>
                                    <ForkIcon width={9.92} height={12.05} />
                                    <Text style={styles.pillText}>{category}</Text>
                                </View>

                                <View style={styles.ratingContainer}>
                                    <StarIcon width={16.87} height={16.11} />
                                    <Text style={styles.ratingText}>{rating}</Text>
                                </View>
                            </View>

                            <View style={styles.textContainer}>
                                <Text style={styles.cardTitle}>{title}</Text>
                                <Text style={styles.cardDesc} numberOfLines={2}>
                                    {/* {description} */}
                                    California, USA
                                </Text>
                            </View>

                        </View>

                    </View>

                </SafeAreaView>
            </ImageBackground>

            {/* ================= MINI INFO ================= */}
            <View style={styles.miniContainer}>
                <View style={styles.miniBtn}>
                    <TimeIcon width={16} height={16} />
                    <Text style={styles.miniText}>Open Now</Text>
                </View>

                <View style={styles.miniBtnWhite}>
                    <MiniMapIcon width={16} height={16} />
                    <Text style={styles.miniTextDark}>2.3 km away</Text>
                </View>
            </View>

            {/* ================= ABOUT ================= */}
            <View style={styles.section}>
                <Text style={styles.titleText}>About This Place</Text>
                <Text style={styles.descText}>
                    {/* {description} */}
                    A premium rooftop restaurant offering panoramic city views, live music, & a curated dining experience. Perfect for romantic evenings, social gatherings, and special occasions.
                </Text>
            </View>

            {/* ================= FEATURES ================= */}
            <View style={styles.section}>
                <Text style={styles.titleText}>What You’ll Love</Text>

                <View style={styles.featuresRow}>
                    <View style={styles.featureCard}>
                        <RoofTopIcon width={24} height={24} />
                        <Text style={styles.featureText}>Scenic rooftop views</Text>
                    </View>

                    <View style={styles.featureCard}>
                        <RoofTopIcon width={24} height={24} />
                        <Text style={styles.featureText}>Live music nights</Text>
                    </View>
                </View>
            </View>
            <View style={styles.section}>
                <Text style={styles.galleryTitle}>Gallery</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {gallery.map((i) => (
                        <ImageBackground
                            // source={}
                            key={i.id}
                            source={resolveImageSource(image || FALLBACK_IMAGE)}
                            style={styles.galleryImage}
                        >
                            <Text style={{ color: COLORS.WHITE, fontFamily: FONT_FAMILY.InterTight_Medium, fontSize: FONT_SIZE.SMALL_TEXT }}>
                                {i.name}
                            </Text>
                        </ImageBackground>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.section}>
                <Text style={styles.titleText}>Reviews</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewScroll}>
                    {[1, 2, 3].map((i) => (
                        <View key={i} style={styles.reviewCard}>
                            <View style={styles.starRow}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <StarIcon key={s} width={14} height={14} />
                                ))}
                            </View>

                            <Text style={styles.reviewComment}>
                                Amazing place with great vibes!
                            </Text>

                            <View style={styles.userRow}>
                                <Image source={{ uri: image || FALLBACK_IMAGE }} style={styles.avatar} />
                                <View>
                                    <Text style={styles.userName}>Emma Roberts</Text>
                                    <Text style={styles.userSub}>– New York, USA</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
            {/* ================= BUTTON ================= */}
            <View style={styles.footerButton}>
                <CustomButton title="Start Route" />
            </View>

        </ScrollView>
    );
};

export default RecommendationDetials;
const styles = StyleSheet.create({
    androidFallback: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "rgba(0,0,0,0.35)", // safe blur replacement
    },
    overlayTint: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "rgba(0,0,0,0.25)",
        zIndex: 1,
    },

    cardContent: {
        paddingVertical: 12,
        zIndex: 2,
    },

    topCardContainer: {
        position: "absolute",
        bottom: 15,
        left: 11,
        right: 11,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    mainContainer: {
        flex: 1,
        backgroundColor: COLORS.BACKGROUND,
    },

    loading: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    background: {
        height: 440,
        width: "100%",
    },

    bgImage: {
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },

    safeArea: {
        flex: 1,
        justifyContent: "space-between",
    },

    topBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 24,
        marginTop: 10,
    },

    rightIcons: {
        flexDirection: "row",
        gap: 10,
    },

    cardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
    },

    pill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.PILL_COLOR,
        paddingHorizontal: 11,
        paddingVertical: 4,
        borderRadius: 76,
    },

    pillText: {
        marginLeft: 7,
        color: COLORS.TEXT_PRIMARY,
        fontSize: 10.72,
        fontFamily: FONT_FAMILY.InterTight_Regular,
    },

    ratingContainer: {
        flexDirection: "row",
        alignItems: "center",
    },

    ratingText: {
        marginLeft: 6,
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.CARD_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
    },

    textContainer: {
        marginTop: 10,
        paddingHorizontal: 16,
    },

    cardTitle: {
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TITLE,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },

    cardDesc: {
        marginTop: 4,
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        lineHeight: 20,
    },

    miniContainer: {
        flexDirection: "row",
        paddingHorizontal: 24,
        marginTop: 20,
        gap: 10,
    },

    miniBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.MINI_BUTTON,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },

    miniBtnWhite: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.WHITE,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        // elevation: 1,
    },

    miniText: {
        color: COLORS.TEXT_GREEN,
        fontSize: FONT_SIZE.CARD_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
    },

    miniTextDark: {
        color: COLORS.TEXT_PRIMARY,
        fontSize: FONT_SIZE.CARD_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
    },

    section: {
        marginHorizontal: 24,
        marginTop: 32,
    },

    titleText: {
        fontSize: FONT_SIZE.LARGE_TEXT,
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
    },
    galleryTitle: {
        marginBottom: 16,
        fontSize: FONT_SIZE.LARGE_TEXT,
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
    },

    descText: {
        marginTop: 12,
        fontSize: FONT_SIZE.SMALL_TEXT,
        color: COLORS.TEXT_SECONDARY,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        lineHeight: 18,
    },

    featuresRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 18,
    },

    featureCard: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        backgroundColor: COLORS.WHITE,
    },

    featureText: {
        flex: 1,
        fontSize: 12,
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.InterTight_Medium,
    },

    galleryScroll: {
        marginTop: 12,
    },

    galleryImage: {
        width: 155,
        height: 183,
        borderRadius: 16,
        marginRight: 12,
        overflow: 'hidden',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 17
    },

    locationContainer: {
        marginHorizontal: 24,
        marginTop: 32,
    },

    locationBox: {
        height: 240,
        marginTop: 18,
        padding: 10,
        borderRadius: 20,
        backgroundColor: COLORS.WHITE,
        // elevation: 2,
    },

    map: {
        flex: 1,
        borderRadius: 18,
        backgroundColor: "#EEE",
    },

    locationFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 10,
    },

    distanceText: {
        fontSize: 11,
        color: COLORS.TEXT_SECONDARY,
        paddingLeft:2
    },

    getDirection: {
        height: 32,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 20,
        backgroundColor: COLORS.GET_DIRECTION_BUTTON,
        gap: 6,
    },

    getDirectionText: {
        color: COLORS.WHITE,
        fontSize: 10,
        fontFamily: FONT_FAMILY.InterTight_Medium,
    },

    reviewScroll: {
        marginTop: 12,
    },

    reviewCard: {
        width: 280,
        padding: 16,
        borderRadius: 16,
        backgroundColor: COLORS.WHITE,
        marginRight: 12,
    },

    starRow: {
        flexDirection: "row",
        gap: 4,
        marginBottom: 8,
    },

    reviewComment: {
        fontSize: 13,
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.InterTight_Regular,
    },

    userRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 16,
        gap: 10,
    },

    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },

    userName: {
        fontSize: 12,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },

    userSub: {
        fontSize: 10,
        color: COLORS.TEXT_SECONDARY,
    },

    footerButton: {
        marginHorizontal: 24,
        marginVertical: 30,
    },
});
