import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { CrossIcon, EventIcon, LocationIcon, TimeIcon } from '../../constants/icons';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';

type Props = {
  visible: boolean;
  event: {
    title: string;
    description?: string;
    coverImage?: string;
    city_name?: string;
    country?: string;
    address?: string;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    category?: string;
  } | null;
  onClose: () => void;
};

const EventDetailModal: React.FC<Props> = ({ visible, event, onClose }) => {
  if (!event) {
    return null;
  }

  const location = [event.city_name, event.country].filter(Boolean).join(', ');
  const timeLabel = [event.startDate, event.startTime].filter(Boolean).join(' • ');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <CrossIcon width={12} height={12} />
          </TouchableOpacity>

          {event.coverImage ? (
            <Image source={{ uri: event.coverImage }} style={styles.image} />
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.pill}>
              <EventIcon width={12} height={14} />
              <Text style={styles.pillText}>{event.category || 'Event'}</Text>
            </View>

            <Text style={styles.title}>{event.title}</Text>

            {location ? (
              <View style={styles.infoRow}>
                <LocationIcon width={12} height={12} />
                <Text style={styles.infoText}>{location}</Text>
              </View>
            ) : null}

            {timeLabel ? (
              <View style={styles.infoRow}>
                <TimeIcon width={12} height={12} />
                <Text style={styles.infoText}>{timeLabel}</Text>
              </View>
            ) : null}

            {event.address ? <Text style={styles.address}>{event.address}</Text> : null}

            <Text style={styles.description}>
              {event.description || 'No event description available.'}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default EventDetailModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    maxHeight: '78%',
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    padding: 18,
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 5,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    marginBottom: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.PILL_COLOR,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  pillText: {
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_PRIMARY,
  },
  title: {
    marginTop: 12,
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  infoRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  address: {
    marginTop: 12,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.TEXT_PRIMARY,
  },
  description: {
    marginTop: 14,
    fontSize: FONT_SIZE.TEXT,
    lineHeight: 22,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
});
