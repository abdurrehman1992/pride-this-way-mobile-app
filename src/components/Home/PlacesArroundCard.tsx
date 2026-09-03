import React, { useState, useEffect } from "react";
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
  FoodTabIcon,
  HeartIcon,
  LocationIcon,
  MusicTabIcon,
  RedHeartIcon,
  StarIcon,
  TimeIcon,
  RouteIcon,
  ForkIcon,
} from "../../constants/icons";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
import { useFavorites } from "../../context/FavoritesContext";
import { showInfo, showSuccess } from "../common/AppToast";
import { sanitizeImageUrl } from '../../services/aiService';

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
  hideTime?: boolean;
  hideRating?: boolean;
  hideLocation?: boolean;
  hideDivider?: boolean;
  onPress?: () => void;
};

const PlacesArroundCard: React.FC<PlacesAroundCardProps> = ({
  id,
  title = "Live Music Night - Jazz Cafe",
  description = "Experience soulful live music tonight",
  image,
  rating = undefined,
  location = "California, USA",
  time = "Today 7PM",
  width,
  variant = "default",
  category = "Event",
  hideTime = false,
  hideRating = false,
  hideLocation = false,
  hideDivider = false,
  onPress,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const favorite = isFavorite(id);

  const resolvedImage =
    imageFailed || !image
      ? undefined
      : typeof image === 'string'
      ? { uri: sanitizeImageUrl(image, title) || image, cache: 'force-cache' }
      : image;

  useEffect(() => {
    let mounted = true;
    if (typeof image === 'string' && !imageFailed) {
      setPrefetching(true);
      // Prefetch to warm Android cache and follow redirects
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Image } = require('react-native');
      const tryPrefetch = async (url: string) => {
        try {
          const sanitized = sanitizeImageUrl(url, title) || url;
          const ok = await Image.prefetch(sanitized);
          if (ok) return true;
        } catch (err) {}
        try {
          const resp = await fetch(url);
          const finalUrl = resp.url || url;
          const sanitized2 = sanitizeImageUrl(finalUrl, title) || finalUrl;
          try {
            const ok2 = await Image.prefetch(sanitized2);
            if (ok2) return true;
          } catch (e) {}
        } catch (e) {}
        return false;
      };

      tryPrefetch(image)
        .then((succeeded) => {
          if (mounted) {
            if (!succeeded) setImageFailed(true);
            setPrefetching(false);
          }
        })
        .catch(() => {
          if (mounted) {
            setImageFailed(true);
            setPrefetching(false);
          }
        });
    }
    return () => {
      mounted = false;
    };
  }, [image, imageFailed]);

  const badgeCategory = (category || "Place").toString();
  const normalizedCategory = badgeCategory === "Music" ? "Music" : badgeCategory === "Food" || badgeCategory === "Restaurant" ? "Restaurant" : badgeCategory === "Adventure" || badgeCategory === "Landmark" ? "Place" : badgeCategory;

  const renderBadgeIcon = () => {
    if (normalizedCategory === "Route") {
      return <RouteIcon width={12} height={12} />;
    }
    if (normalizedCategory === "Restaurant") {
      return <ForkIcon width={12} height={12} />;
    }
    if (normalizedCategory === "Music") {
      return <MusicTabIcon width={12} height={12} />;
    }
    if (normalizedCategory === "Place" || normalizedCategory === "Landmark" || normalizedCategory === "Adventure") {
      return <LocationIcon width={10} height={12} />;
    }
    return <EventIcon width={12} height={14} />;
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
        category: category as any,
        routeName: category === "Route" ? "MyTourStart" : "PlacesArroundDetails",
        routeParams: { itemId: id }
      });
      showSuccess("Added to favorites", "Successfully added to favorites");
    }
  };

  const handleHeartPress = (event: any) => {
    event?.stopPropagation?.();
    handleFavorite();
  };

  const showRating = Boolean(rating) && !hideRating;
  const showTime = Boolean(time) && !hideTime;
  const showLocation = Boolean(location) && !hideLocation;
  const visibleCount = (showRating ? 1 : 0) + (showLocation ? 1 : 0) + (showTime ? 1 : 0);
  const hasBottom = visibleCount > 0;
  const containerHeight = hasBottom ? 126 : 96;
  const displayTime = typeof time === "string"
    ? time.replace(/^\s*Open\s*(?:[•\-]|\s)*\s*/i, "").trim()
    : time;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[{ ...styles.container, height: containerHeight }, { width: width ?? "100%" }, variant === "compact" && styles.containerCompact]}
    >
      <View style={styles.topSection}>
        <Image
          source={resolvedImage}
          onError={() => setImageFailed(true)}
          style={styles.image}
          resizeMode="cover"
        />

        <View style={styles.textContainer}>
          <View style={styles.badge}>
            {renderBadgeIcon()}
            <Text style={styles.badgeText}>
              {normalizedCategory === "Route"
                ? "Route"
                : normalizedCategory === "Restaurant"
                ? "Restaurant"
                : normalizedCategory === "Music"
                ? "Music"
                : normalizedCategory === "Place" || normalizedCategory === "Landmark" || normalizedCategory === "Adventure"
                ? "Place"
                : normalizedCategory}
            </Text>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>

          <Text style={styles.description} numberOfLines={1}>{description}</Text>
        </View>

        <TouchableOpacity style={styles.heartIcon} onPress={handleHeartPress}>
          {favorite ? <RedHeartIcon width={15} height={13} /> : <HeartIcon width={15} height={13} />}
        </TouchableOpacity>
      </View>

      {!hideDivider && <View style={styles.divider} />}

      {hasBottom ? (
        (() => {
          const justify = visibleCount === 1 ? 'flex-start' : 'space-between';
          return (
            <View style={[styles.bottomSection, variant === "compact" && styles.bottomSectionCompact, { justifyContent: justify as any }]}>
                {showRating ? (
                <View style={styles.infoItem}>
                  <StarIcon width={12} height={12} />
                  <Text style={styles.infoText}>{rating}</Text>
                </View>
              ) : null}

                {showLocation ? (
                <View style={styles.infoItem}>
                  <LocationIcon width={10} height={12} />
                  <Text style={styles.infoText}>{location}</Text>
                </View>
              ) : null}

              {showTime ? (
                <View style={styles.infoItem}>
                  <TimeIcon width={13} height={13} />
                  <Text style={[styles.infoText, { color: COLORS.TEXT_GREEN }]}>{displayTime}</Text>
                </View>
              ) : null}
            </View>
          );
        })()
      ) : null}
    </TouchableOpacity>
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
    backgroundColor: COLORS.TEXT_SECONDARY,
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

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 8,
  },

  title: {
    flex: 1,
    fontSize: FONT_SIZE.SMALL_TEXT,
    color: COLORS.TEXT_PRIMARY,
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
