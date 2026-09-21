import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '../../constants/colors';
import { FONT_FAMILY } from '../../constants/fonts';

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
};

const ZoomControls: React.FC<Props> = ({ onZoomIn, onZoomOut }) => (
  <View style={styles.container}>
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.button, styles.buttonTop]}
      onPress={onZoomIn}
    >
      <Text style={styles.buttonText}>+</Text>
    </TouchableOpacity>
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.button}
      onPress={onZoomOut}
    >
      <Text style={styles.buttonText}>-</Text>
    </TouchableOpacity>
  </View>
);

export default React.memo(ZoomControls);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 18,
    bottom: 200,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#0A1B2A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    zIndex: 20,
  },
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonTop: {
    borderBottomWidth: 1,
    borderBottomColor: '#E6EDF3',
  },
  buttonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
});
