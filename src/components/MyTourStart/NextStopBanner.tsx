import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../constants/colors';
import { FONT_FAMILY } from '../../constants/fonts';

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

type Props = {
  stopName: string;
  distanceMeters: number;
};

const NextStopBanner: React.FC<Props> = ({ stopName, distanceMeters }) => (
  <View style={styles.wrapper} pointerEvents="none">
    <View style={styles.card}>
      <View style={styles.directionBadge}>
        <Text style={styles.directionArrow}>↑</Text>
      </View>
      <View style={styles.copy}>
        <View style={styles.eyebrowPill}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>TOWARDS DESTINATION</Text>
        </View>
        <Text numberOfLines={2} style={styles.destination}>
          {stopName}
        </Text>
        <View style={styles.distancePill}>
          <Text style={styles.distance}>{formatDistance(distanceMeters)} to next stop</Text>
        </View>
      </View>
    </View>
  </View>
);

export default React.memo(NextStopBanner);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 30,
  },
  card: {
    minHeight: 88,
    borderRadius: 20,
    backgroundColor: COLORS.BUTTON_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0A1B2A',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },
  directionBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionArrow: {
    color: COLORS.WHITE,
    fontSize: 42,
    lineHeight: 46,
    width: 50,
    textAlign: 'center',
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  copy: {
    flex: 1,
    marginLeft: 11,
    alignItems: 'flex-start',
  },
  eyebrowPill: {
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,44,84,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrowDot: {
    width: 5,
    height: 5,
    marginRight: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PILL_COLOR,
  },
  eyebrow: {
    color: COLORS.WHITE,
    fontSize: 9,
    letterSpacing: 0.45,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  destination: {
    marginTop: 2,
    color: COLORS.WHITE,
    fontSize: 18,
    lineHeight: 19,
    fontFamily: FONT_FAMILY.InterTight_Bold,
  },
  distancePill: {
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  distance: {
    color: COLORS.WHITE,
    fontSize: 11,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
});
