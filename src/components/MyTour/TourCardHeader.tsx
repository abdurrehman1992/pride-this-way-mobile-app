import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import ActionTouchable from '../common/ActionTouchable';
import {
  DownArrow,
  EarnedPointIcon,
  HeartIcon,
  IconDelete,
  IconUp,
  RedHeartIcon,
  TourLocationIcon,
} from '../../constants/icons';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';

type Props = {
  title: string;
  previewImage: string;
  locationCount: number;
  badge: { label: string; color: string } | null;
  favorite: boolean;
  expanded: boolean;
  openLabel?: string;
  onOpen?: () => unknown;
  onFavorite: () => unknown;
  onToggle: () => void;
  onDelete?: () => void;
};

export default function TourCardHeader({
  title,
  previewImage,
  locationCount,
  badge,
  favorite,
  expanded,
  openLabel,
  onOpen,
  onFavorite,
  onToggle,
  onDelete,
}: Props) {
  return (
    <View style={styles.cardTop}>
      <Image
        source={previewImage ? { uri: previewImage } : undefined}
        style={styles.imagePlaceholder}
      />
      <View style={styles.cardInfo}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.tourTitle}>{title}</Text>

          <View style={styles.iconRow}>
            {onDelete && (
              <ActionTouchable style={styles.topIcons} onPress={onDelete}>
                <IconDelete width={15} height={15} />
              </ActionTouchable>
            )}

            <ActionTouchable
              style={styles.topIcons}
              accessibilityRole="button"
              accessibilityLabel={
                expanded ? 'Collapse tour locations' : 'Expand tour locations'
              }
              accessibilityState={{ expanded }}
              onPress={onToggle}
            >
              {expanded ? (
                <IconUp width={16} height={16} />
              ) : (
                <DownArrow width={16} height={16} />
              )}
            </ActionTouchable>
          </View>
        </View>

        <View style={styles.iconInfoRow}>
          <View style={styles.iconTextGroup}>
            <TourLocationIcon width={20} height={20} />
            <Text style={styles.textInfo}>Visit {locationCount} Locations</Text>
          </View>
          {badge ? (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: badge.color + '20',
                  borderColor: badge.color,
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.iconInfoRow}>
          <View style={styles.iconTextGroup}>
            <EarnedPointIcon width={20} height={20} />
            <Text style={styles.textInfo}>
              Earn <Text style={styles.textGreen}>+{locationCount * 15}</Text>{' '}
              Points
            </Text>
          </View>
        </View>

        <View style={styles.cardActionRow}>
          <View style={styles.cardMetaActions}>
            <ActionTouchable
              style={styles.cardFavoriteBtn}
              accessibilityRole="button"
              accessibilityLabel={
                favorite
                  ? 'Remove tour from favorites'
                  : 'Add tour to favorites'
              }
              onPress={onFavorite}
            >
              {favorite ? (
                <RedHeartIcon width={14} height={12} />
              ) : (
                <HeartIcon width={14} height={12} />
              )}
            </ActionTouchable>
          </View>
          {onOpen && openLabel ? (
            <ActionTouchable style={styles.cardStartBtn} onPress={onOpen}>
              <Text style={styles.cardStartBtnText}>{openLabel}</Text>
            </ActionTouchable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export const tourCardStyles = StyleSheet.create({
  tourCard: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: COLORS.WHITE,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTop: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imagePlaceholder: {
    width: 70,
    height: 100,
    borderRadius: 6.7,
    backgroundColor: '#EDEDED',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  tourTitle: {
    flex: 1,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  iconInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  topIcons: {
    height: 20,
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  textInfo: {
    fontSize: FONT_SIZE.PILL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
    flexShrink: 1,
  },
  textGreen: {
    color: COLORS.TEXT_GREEN,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardMetaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  cardFavoriteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
  },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  cardStartBtn: {
    height: 36,
    minWidth: 112,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: COLORS.BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStartBtnText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    // marginBottom:10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
});
const styles = tourCardStyles;
