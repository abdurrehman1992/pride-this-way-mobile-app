import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  DimensionValue,
} from "react-native";
import { COLORS } from "../../constants/colors";
import {
  EventIcon,
  HeartIcon,
  LocationIcon,
  RedHeartIcon,
  StarIcon,
  TimeIcon,
  RouteIcon,
} from "../../constants/icons";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
import { PLACES_ARROUND } from "../../constants/images";
import { useFavorites } from "../../context/FavoritesContext";
import { showInfo, showSuccess } from "../common/AppToast";

type PlacesAroundCardProps = {
  id: string;
  title?: string;
  description?: string;
  image?: any;
  rating?: string;
  location?: string;
  time?: string;
  width?: DimensionValue;
  variant?: "default" | "compact";
  category?: string;
};

const PlacesArroundCard: React.FC<PlacesAroundCardProps> = ({
  id,
  title = "Live Music Night - Jazz Cafe",
  description = "Experience soulful live music tonight",
  image = PLACES_ARROUND,
  rating = "4.5",
  location = "California, USA",
  time = "Today 7PM",
  width,
  variant = "default",
  category = "Event",
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
        category: category as any,
        routeName: category === "Route" ? "MyTourStart" : "PlacesArroundDetails",
        routeParams: { itemId: id }
      });
      showSuccess("Added to favorites", "Successfully added to favorites");
    }
  };

  return (
    <View style={[styles.container, { width: width ?? "100%" }, variant === "compact" && styles.containerCompact]}>
      <View style={styles.topSection}>
        <Image source={typeof image === 'string' ? { uri: image } : image} style={styles.image} />

        <View style={styles.textContainer}>
          <View style={styles.badge}>
            {category === "Route" ? (
              <RouteIcon width={12} height={12} />
            ) : category === "Place" ? (
              <LocationIcon width={10} height={12} />
            ) : (
              <EventIcon width={12} height={14} />
            )}
            <Text style={styles.badgeText}>
              {category === "Route" ? "Route" : category === "Place" ? "Place" : "Event"}
            </Text>
          </View>

          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.description} numberOfLines={1}>{description}</Text>
        </View>

        <TouchableOpacity style={styles.heartIcon} onPress={handleFavorite}>
          {favorite ? <RedHeartIcon width={15} height={13} /> : <HeartIcon width={15} height={13} />}
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />
      
      <View style={[styles.bottomSection, variant === "compact" && styles.bottomSectionCompact]}>
        <View style={styles.infoItem}>
          <StarIcon width={15} height={14} />
          <Text style={styles.infoText}>{rating}</Text>
        </View>
        <View style={styles.infoItem}>
          <LocationIcon width={10} height={12} />
          <Text style={styles.infoText}>{location}</Text>
        </View>
        <View style={styles.infoItem}>
          <TimeIcon width={13} height={13} />
          <Text style={[styles.infoText, { color: COLORS.TEXT_GREEN }]}>{time}</Text>
        </View>
      </View>
    </View>
  );
};

export default PlacesArroundCard;

const styles = StyleSheet.create({
  container: {
    height: 126,
    backgroundColor: COLORS.WHITE,
    borderRadius: 14,
    paddingTop: 9,
  },
  containerCompact: {
    paddingHorizontal: 0,
  },

  topSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: 9,
  },

  image: {
    width: 64,
    height: 62,
    borderRadius: 6.71,
  },

  textContainer: {
    flex: 1,
    marginLeft: 12,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.PILL_COLOR,
    paddingHorizontal: 11,
    height: 20,
    borderRadius: 76.6,
    alignSelf: "flex-start",
  },

  badgeText: {
    fontSize: FONT_SIZE.PILL_TEXT,
    marginLeft: 7,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },

  title: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    color: COLORS.TEXT_PRIMARY,
    marginTop: 6,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },

  description: {
    fontSize: FONT_SIZE.CARD_TEXT,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 3,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },

  heartIcon: {
    position: "absolute",
    right: 0,
    top: 0,
    paddingRight: 9,
  },

  divider: {
    height: 1,
    width: "100%",
    backgroundColor: COLORS.DIVIDER,
    marginTop: 11,
  },

  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    height: 43,
  },

  bottomSectionCompact: {
    paddingRight: 60
  },

  infoItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  infoText: {
    fontSize: FONT_SIZE.CARD_TEXT,
    marginLeft: 10,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
});