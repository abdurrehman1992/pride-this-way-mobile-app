import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { LocationIcon } from '../../constants/icons';
import { COLORS } from '../../constants/colors';

type Props = {
  active: boolean;            // true = blue, free mode; false = gray, follow mode
  onPress: () => void;
  onLongPress?: () => void;
};

const RecenterButton: React.FC<Props> = ({ active, onPress, onLongPress }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={400}
    style={[styles.button, active ? styles.active : styles.inactive]}
  >
    <LocationIcon width={22} height={22} />
  </TouchableOpacity>
);

export default React.memo(RecenterButton);

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 18,
    bottom: 130,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A1B2A',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  active: { backgroundColor: COLORS.BUTTON_COLOR },
  inactive: { backgroundColor: COLORS.WHITE },
});
