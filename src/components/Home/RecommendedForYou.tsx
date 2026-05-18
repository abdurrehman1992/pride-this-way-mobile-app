import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from "react-native";
import { RECOMMENDED_IMAGE } from "../../constants/images";
import { COLORS } from "../../constants/colors";
import {
  ForkIcon,
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
  onPress?: () => void;
};

const RecommendedForYou: React.FC<RecommendedProps> = ({
  id,
  title,
  description,
  rating = "4.7",
  image = RECOMMENDED_IMAGE,
  onPress,
}) => {
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();

  const favorite = isFavorite(id);
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
        category: "Restaurant",
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
          source={typeof image === "string" ? { uri: image } : image}
          style={styles.image}
          imageStyle={styles.imageRadius}
        >
          <View style={styles.overlay} />
          <View style={styles.topRow}>
            <View style={styles.pill}>
              <ForkIcon width={9.92} height={12.05} />
              <Text style={styles.pillText}>Restaurant</Text>
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
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.desc}>{description}</Text>
            </View>

            <View style={styles.ratingContainer}>
              <StarIcon width={15} height={14.32} />
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
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
    marginBottom: 9
  },
  image: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 21,
    paddingBottom: 18,
    paddingTop: 15,
    overflow: "hidden",
  },
  imageRadius: {
    borderRadius: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  title: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium
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
    // backgroundColor: "rgba(0,0,0,0.6)",
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
