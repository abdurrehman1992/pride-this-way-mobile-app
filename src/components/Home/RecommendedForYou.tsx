import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from "react-native";
import { COLORS } from "../../constants/colors";
import {
  ForkIcon,
  EventIcon,
  LocationIcon,
  MusicTabIcon,
  StarIcon,
  WhiteHeart,
  RedHeartIcon,
} from "../../constants/icons";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
import { useFavorites } from "../../context/FavoritesContext";
import { showInfo, showSuccess } from "../common/AppToast";

type RecommendedProps = {
  id: string;
  title: string;
  description: string;
  rating?: string;
  image?: any;
  fallbackImage?: any;
  category?: string;
  originalPlace?: any;
  onPress?: () => void;
};

const RecommendedForYou: React.FC<RecommendedProps> = ({
  id,
  title,
  description,
  rating = "4.7",
  image,
  fallbackImage,
  category = "Restaurant",
  onPress,
}) => {
  const imageCandidates = useMemo(
    () => [image, fallbackImage].filter(Boolean),
    [image, fallbackImage],
  );
  const [imageIndex, setImageIndex] = useState(0);
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();

  useEffect(() => setImageIndex(0), [image, fallbackImage]);
  const currentImage = imageCandidates[Math.min(imageIndex, imageCandidates.length - 1)];
  const resolvedImage = typeof currentImage === "string" ? { uri: currentImage } : currentImage;

  const favorite = isFavorite(id);
  const badgeCategory = (category || "Restaurant").toString();
  const normalizedCategory =
    badgeCategory === "Food" || badgeCategory === "Restaurant"
      ? "Restaurant"
      : badgeCategory === "Music"
        ? "Music"
        : badgeCategory === "Event"
          ? "Event"
          : badgeCategory === "Route"
            ? "Route"
            : "Place";

  const renderBadgeIcon = () => {
    if (normalizedCategory === "Restaurant") {
      return <ForkIcon width={9.92} height={12.05} />;
    }
    if (normalizedCategory === "Music") {
      return <MusicTabIcon width={9.92} height={12.05} />;
    }
    if (normalizedCategory === "Place") {
      return <LocationIcon width={9.92} height={12.05} />;
    }
    return <EventIcon width={9.92} height={12.05} />;
  };

  const handleFavorite = () => {
    if (favorite) {
      removeFromFavorites(id);
      showInfo('Favorites Removed', "Successfully removed from favorites");
    } else {
      addToFavorites({
        id,
        title,
        description,
        rating,
        image,
        category: normalizedCategory,
        routeName: "RecommendationDetials",
        routeParams: { itemId: id }
      });
      showSuccess("Added to favorites", "Successfully added to favorites");
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <View style={styles.container}>
        <ImageBackground
          source={resolvedImage}
          // source={{
          //   // uri:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Entrance_lahore_zoo.jpeg/500px-Entrance_lahore_zoo.jpeg?utm_source=en.wikipedia.org&utm_campaign=parser&utm_content=thumbnail",
          //   // uri:"https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmMKRE25A-yCcxlbogwTZ5gLqC5qiz2tuzNb6N7v3GF2URIctYQuVnsqeetnLm8n0nilDaWosnqJbhkY0UYHIQ4cPCJK06-Fa8IfIyjnwj8DshyxNBO8Ri2ubZ5AVH2IEQ8iMpIPYfl4Pk=s1360-w1360-h1020-rw"
          //   uri:"https://nishatemporium.com/wp-content/uploads/2019/07/Emporium-Night.jpg"
          // }}
          onError={(event) => {
            // console.warn('[RecommendedForYou] image failed:', title, event.nativeEvent?.error);
            setImageIndex(current => Math.min(current + 1, imageCandidates.length - 1));
          }}
          // onLoad={() => {
          //   console.log("✅ IMAGE LOADED:", title);
          // }}
          style={styles.image}
          imageStyle={styles.imageRadius}
        >
          <View style={styles.overlay} />
          <View style={styles.topRow}>
            <View style={styles.pill}>
              {renderBadgeIcon()}
              <Text style={styles.pillText}>{normalizedCategory}</Text>
            </View>

            <TouchableOpacity onPress={handleFavorite}>
              {favorite ? (
                <RedHeartIcon width={15} height={12.91} />
              ) : (
                <WhiteHeart width={15} height={12.91} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.bottomContent}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.ratingContainer}>
                <StarIcon width={15} height={14.32} />
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            </View>

            <Text style={styles.desc}>{description}</Text>
          </View>
        </ImageBackground>
      </View>
    </TouchableOpacity>
  );
};

export default RecommendedForYou;

const styles = StyleSheet.create({
  container: {
    height: 205,
    marginHorizontal: 21,
    marginBottom: 9,
    borderRadius: 20,
    overflow: "hidden",
  },
  image: {
    flex: 1,
    backgroundColor: COLORS.TEXT_SECONDARY,
    justifyContent: "space-between",
    paddingHorizontal: 21,
    paddingBottom: 18,
    paddingTop: 15,
    overflow: "hidden",
    borderRadius: 20,
  },
  imageRadius: {
    borderRadius: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 20,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    fontSize: 10.72,
    marginLeft: 7,
  },
  heart: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.TEXT_PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomContent: {
    justifyContent: "flex-end",
  },
  titleWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  desc: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    marginTop: 5,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ratingText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.CARD_TEXT,
    marginLeft: 6,
  },
});
