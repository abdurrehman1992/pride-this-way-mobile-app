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
  variant?: 'default' | 'compact';
};

const EventDetailModal: React.FC<Props> = ({
  visible,
  event,
  onClose,
  variant = 'default',
}) => {
  if (!event) {
    return null;
  }

  const location = [event.city_name, event.country].filter(Boolean).join(', ');
  const timeLabel = [event.startDate, event.startTime].filter(Boolean).join(' • ');
  const isCompact = variant === 'compact';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, isCompact && styles.cardCompact]}>
          <View style={styles.headerRow}>
            <View />
            <TouchableOpacity
              style={[styles.closeButton, isCompact && styles.closeButtonCompact]}
              onPress={onClose}
            >
              <CrossIcon width={12} height={12} />
            </TouchableOpacity>
          </View>

          {event.coverImage ? (
            <Image
              source={{ uri: event.coverImage }}
              style={[styles.image, isCompact && styles.imageCompact]}
            />
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.pill}>
              <EventIcon width={12} height={14} />
              <Text style={styles.pillText}>{event.category || 'Event'}</Text>
            </View>

            <Text style={[styles.title, isCompact && styles.titleCompact]}>{event.title}</Text>

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

            <Text
              style={[styles.description, isCompact && styles.descriptionCompact]}
              numberOfLines={isCompact ? 4 : undefined}
            >
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
  cardCompact: {
    maxHeight: '56%',
    borderRadius: 18,
    padding: 16,
  },
  headerRow: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  closeButtonCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    marginBottom: 16,
  },
  imageCompact: {
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
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
  titleCompact: {
    marginTop: 10,
    fontSize: 18,
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
  descriptionCompact: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
