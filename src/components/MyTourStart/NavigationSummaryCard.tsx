import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '../../constants/colors';
import { FONT_FAMILY } from '../../constants/fonts';

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.max(0, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
};

const formatArrivalTime = (arrivalTime: Date) =>
  arrivalTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

type Props = {
  arrivalTime?: Date;
  remainingDurationSeconds?: number;
  remainingDistanceMeters?: number;
  totalLocations: number;
  remainingLocations: number;
  isPausing: boolean;
  onPause: () => void;
  bottomInset?: number;
};

const NavigationSummaryCard: React.FC<Props> = ({
  arrivalTime,
  remainingDurationSeconds,
  remainingDistanceMeters,
  totalLocations,
  remainingLocations,
  isPausing,
  onPause,
  bottomInset = 0,
}) => (
  <View
    style={[
      styles.wrapper,
      {
        minHeight: 176 + bottomInset,
        paddingBottom: Math.max(8, bottomInset + 5),
      },
    ]}
  >
    <View style={styles.navigationData}>
      {arrivalTime && remainingDurationSeconds !== undefined && remainingDistanceMeters !== undefined ? (
        <>
          <Text style={styles.summaryHeading}>TOTAL TOUR REMAINING</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>TIME LEFT</Text>
              <Text style={styles.duration}>{formatDuration(remainingDurationSeconds)}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>DISTANCE LEFT</Text>
              <Text style={styles.distanceValue}>{formatDistance(remainingDistanceMeters)}</Text>
            </View>
          </View>
          <Text style={styles.arrival}>Estimated arrival · {formatArrivalTime(arrivalTime)}</Text>
        </>
      ) : (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.BUTTON_COLOR} />
          <Text style={styles.loadingText}>Calculating route and arrival time…</Text>
        </View>
      )}
      <View style={styles.locationsRow}>
        <View style={styles.locationStat}>
          <Text style={styles.locationStatLabel}>TOTAL LOCATIONS</Text>
          <Text style={styles.locationStatValue}>{totalLocations}</Text>
        </View>
        <View style={styles.locationStatDivider} />
        <View style={styles.locationStat}>
          <Text style={styles.locationStatLabel}>REMAINING LOCATIONS</Text>
          <Text style={styles.locationStatValue}>{remainingLocations}</Text>
        </View>
      </View>
    </View>
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Pause tour"
      activeOpacity={0.85}
      disabled={isPausing}
      onPress={onPause}
      style={[styles.pauseButton, isPausing && styles.pauseButtonDisabled]}
    >
      {isPausing ? (
        <View style={styles.pauseContent}>
          <ActivityIndicator size="small" color={COLORS.WHITE} />
          <Text style={styles.pauseText}>Pausing…</Text>
        </View>
      ) : (
        <Text style={styles.pauseText}>Pause Tour</Text>
      )}
    </TouchableOpacity>
  </View>
);

export default React.memo(NavigationSummaryCard);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 176,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 8,
    zIndex: 28,
    shadowColor: '#0A1B2A',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  navigationData: {
    minHeight: 102,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    position: 'absolute',
    top: 6,
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#B9C0C6',
  },
  summaryHeading: {
    color: COLORS.BUTTON_COLOR,
    fontSize: 10,
    letterSpacing: 0.65,
    fontFamily: FONT_FAMILY.InterTight_Bold,
  },
  metricsRow: {
    alignSelf: 'stretch',
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 9,
    letterSpacing: 0.4,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.DIVIDER,
  },
  duration: {
    color: COLORS.PRIMARY,
    fontSize: 19,
    lineHeight: 23,
    fontFamily: FONT_FAMILY.InterTight_Bold,
  },
  distanceValue: {
    color: COLORS.PRIMARY,
    fontSize: 19,
    lineHeight: 23,
    fontFamily: FONT_FAMILY.InterTight_Bold,
  },
  arrival: {
    marginTop: 0,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  locationsRow: {
    alignSelf: 'stretch',
    height: 25,
    marginTop: 4,
    borderRadius: 13,
    backgroundColor: COLORS.BACKGROUND,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationStat: {
    flex: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationStatLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 8,
    letterSpacing: 0.3,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  locationStatValue: {
    marginLeft: 6,
    color: COLORS.PRIMARY,
    fontSize: 13,
    fontFamily: FONT_FAMILY.InterTight_Bold,
  },
  locationStatDivider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.DIVIDER,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  loadingText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  pauseButton: {
    alignSelf: 'stretch',
    height: 43,
    marginTop: 7,
    borderRadius: 22,
    backgroundColor: COLORS.BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButtonDisabled: {
    opacity: 0.75,
  },
  pauseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  pauseText: {
    color: COLORS.WHITE,
    fontSize: 15,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
});
