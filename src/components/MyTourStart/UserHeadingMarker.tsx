import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

type Props = {
  rotation: number;
};

const UserHeadingMarker: React.FC<Props> = ({ rotation }) => (
  <View style={styles.container} pointerEvents="none">
    <View
      style={[
        styles.cone,
        { transform: [{ rotate: `${rotation}deg` }] },
      ]}
    >
      <Svg width={92} height={92} viewBox="0 0 92 92">
        <Defs>
          <LinearGradient id="headingCone" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#2F80ED" stopOpacity="0.44" />
            <Stop offset="0.55" stopColor="#2F80ED" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#2F80ED" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path
          d="M46 46 L12 5 Q46 -4 80 5 Z"
          fill="url(#headingCone)"
        />
      </Svg>
    </View>

    <View style={styles.dotOuter}>
      <View style={styles.dotInner} />
    </View>
  </View>
);

export default React.memo(UserHeadingMarker);

const styles = StyleSheet.create({
  container: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cone: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  dotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B4DA2',
    shadowOpacity: 0.32,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  dotInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1D6FF2',
  },
});
