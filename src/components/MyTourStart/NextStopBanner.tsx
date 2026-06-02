import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';

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
    <View style={styles.pill}>
      <Text numberOfLines={1} style={styles.text}>
        Next: {stopName} · {formatDistance(distanceMeters)}
      </Text>
    </View>
  </View>
);

export default React.memo(NextStopBanner);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '92%',
  },
  text: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
});
