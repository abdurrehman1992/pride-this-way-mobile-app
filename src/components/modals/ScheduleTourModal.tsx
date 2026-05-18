import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';

type Props = {
  visible: boolean;
  onClose: () => void;
  onStartNow: () => void;
  onSchedule: (isoDate: string) => void;
};

const ScheduleTourModal = ({ visible, onClose, onStartNow, onSchedule }: Props) => {
  const translateY = useRef(new Animated.Value(1000)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 150) {
          Animated.timing(translateY, { toValue: 1000, duration: 250, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    } else {
      translateY.setValue(1000);
    }
  }, [visible, translateY]);

  const handleScheduleLater = () => {
    // Default to tomorrow when user picks "Schedule for Later"
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onSchedule(tomorrow.toISOString());
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />

          <Text style={styles.title}>When do you want to start?</Text>
          <Text style={styles.subtitle}>
            Start your tour right now or save it to begin later.
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleScheduleLater} activeOpacity={0.85}>
              <Text style={styles.secondaryText}>Schedule for Later</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={onStartNow} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Start Now</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default ScheduleTourModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 42,
  },
  dragHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C9C9C9',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 32,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  primaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 40,
    backgroundColor: COLORS.BUTTON_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    color: COLORS.WHITE,
  },
});
