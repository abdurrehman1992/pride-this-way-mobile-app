import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../constants/colors';

type Props = {
  count?: number;
  variant?: 'row' | 'image';
};

const LoadingCards: React.FC<Props> = ({ count = 3, variant = 'row' }) => (
  <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading content" style={styles.list}>
    {Array.from({ length: count }, (_, index) => (
      <View key={index} style={styles.card}>
        {variant === 'image' ? (
          <>
            <View style={[styles.block, styles.wideImage]} />
            <View style={styles.imageText}>
              <View style={[styles.block, styles.title]} />
              <View style={[styles.block, styles.line]} />
            </View>
          </>
        ) : (
          <View style={styles.row}>
            <View style={[styles.block, styles.thumbnail]} />
            <View style={styles.rowText}>
              <View style={[styles.block, styles.title]} />
              <View style={[styles.block, styles.line]} />
              <View style={[styles.block, styles.shortLine]} />
            </View>
          </View>
        )}
      </View>
    ))}
  </View>
);

export default LoadingCards;

const styles = StyleSheet.create({
  list: {
    gap: 14,
  },
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  block: {
    backgroundColor: '#E5E8EC',
    borderRadius: 8,
  },
  thumbnail: {
    width: 76,
    height: 76,
  },
  rowText: {
    flex: 1,
    gap: 9,
    marginLeft: 12,
  },
  title: {
    width: '68%',
    height: 16,
  },
  line: {
    width: '90%',
    height: 11,
  },
  shortLine: {
    width: '52%',
    height: 11,
  },
  wideImage: {
    width: '100%',
    height: 150,
    borderRadius: 0,
  },
  imageText: {
    gap: 9,
    padding: 12,
  },
});
