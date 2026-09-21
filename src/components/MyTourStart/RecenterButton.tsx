import ActionTouchable from "../common/ActionTouchable";
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { COLORS } from '../../constants/colors';

type Props = {
  active: boolean;            // true = blue, free mode; false = gray, follow mode
  onPress: () => void;
  onLongPress?: () => void;
  bottomOffset?: number;
};

const RecenterButton: React.FC<Props> = ({
  active,
  onPress,
  onLongPress,
  bottomOffset = 178,
}) => (
  <ActionTouchable
    accessibilityRole="button"
    accessibilityLabel="Re-center map on current location"
    activeOpacity={0.85}
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={400}
    style={[
      styles.button,
      { bottom: bottomOffset },
      active ? styles.active : styles.inactive,
    ]}
  >
    <View style={styles.targetIcon} pointerEvents="none">
      <View style={[styles.verticalLine, active && styles.activeTargetColor]} />
      <View style={[styles.horizontalLine, active && styles.activeTargetColor]} />
      <View style={[styles.targetRing, active && styles.activeTargetRing]}>
        <View style={[styles.targetDot, active && styles.activeTargetColor]} />
      </View>
    </View>
  </ActionTouchable>
);

export default React.memo(RecenterButton);

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A1B2A',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 40,
  },
  active: {
    backgroundColor: COLORS.BUTTON_COLOR,
  },
  inactive: { backgroundColor: COLORS.WHITE },
  targetIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalLine: {
    position: 'absolute',
    width: 2,
    height: 30,
    borderRadius: 1,
    backgroundColor: COLORS.BUTTON_COLOR,
  },
  horizontalLine: {
    position: 'absolute',
    width: 30,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.BUTTON_COLOR,
  },
  targetRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.BUTTON_COLOR,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.BUTTON_COLOR,
  },
  activeTargetColor: {
    backgroundColor: COLORS.WHITE,
  },
  activeTargetRing: {
    borderColor: COLORS.WHITE,
    backgroundColor: COLORS.BUTTON_COLOR,
  },
});
