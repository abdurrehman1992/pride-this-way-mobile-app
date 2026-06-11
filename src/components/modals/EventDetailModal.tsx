import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { CrossIcon, EventIcon, LocationIcon, RoundedCross, TimeIcon } from '../../constants/icons';
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
  onDismiss?: () => void;
  variant?: 'default' | 'compact';
  statusMessage?: string;
  statusTone?: 'info' | 'warning' | 'success';
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryDisabled?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  onRemoveFromTour?: () => void;
};

const EventDetailModal: React.FC<Props> = ({
  visible,
  onDismiss,
  event,
  onClose,
  variant = 'default',
  statusMessage,
  statusTone = 'info',
  primaryActionLabel,
  onPrimaryAction,
  primaryDisabled = false,
  secondaryActionLabel,
  onSecondaryAction,
  onRemoveFromTour,
}) => {
  if (!event) {
    return null;
  }

  const location = [event.city_name, event.country].filter(Boolean).join(', ');
  const timeLabel = [event.startDate, event.startTime].filter(Boolean).join(' • ');
  const isCompact = variant === 'compact';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, isCompact && styles.cardCompact]}>
          <View>

            {event.coverImage ? (
              <ImageBackground
                source={{ uri: event.coverImage }}
                style={[styles.image, isCompact && styles.imageCompact]}
              >
                <View style={styles.headerRow}>
                  <View />
                  <TouchableOpacity
                    style={[styles.closeButton, isCompact && styles.closeButtonCompact]}
                    onPress={onClose}
                  >
                    <RoundedCross width={28} height={32} />
                  </TouchableOpacity>
                </View>
              </ImageBackground>
            ) : null}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!event.coverImage ?
              <View style={styles.headerRow}>
                <View />

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={onClose}
                  style={styles.closeBtn}
                >
                  <CrossIcon width={16} height={16} />
                </TouchableOpacity>
              </View> :
              null
            }
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

            {statusMessage ? (
              <View
                style={[
                  styles.statusBanner,
                  statusTone === 'warning' && styles.statusBannerWarning,
                  statusTone === 'success' && styles.statusBannerSuccess,
                ]}
              >
                <Text style={styles.statusBannerText}>{statusMessage}</Text>
              </View>
            ) : null}

            {primaryActionLabel && onPrimaryAction ? (
              <TouchableOpacity
                style={[styles.primaryBtn, primaryDisabled && styles.primaryBtnDisabled]}
                onPress={onPrimaryAction}
                disabled={primaryDisabled}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>{primaryActionLabel}</Text>
              </TouchableOpacity>
            ) : null}

            {secondaryActionLabel && onSecondaryAction ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={onSecondaryAction} activeOpacity={0.85}>
                <Text style={styles.secondaryBtnText}>{secondaryActionLabel}</Text>
              </TouchableOpacity>
            ) : null}

            {onRemoveFromTour ? (
              <TouchableOpacity style={styles.removeBtn} onPress={onRemoveFromTour} activeOpacity={0.85}>
                <Text style={styles.removeBtnText}>Remove from tour</Text>
              </TouchableOpacity>
            ) : null}
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
    // paddingHorizontal: 24,
    alignItems: 'center'
  },
  card: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    padding: 12,
  },
  cardCompact: {
    maxHeight: '56%',
    borderRadius: 18,
    padding: 16,
  },
  headerRow: {
    // marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    marginRight: 5
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden'
  },
  imageCompact: {
    height: 120,
    borderRadius: 12,
    // marginBottom: 12,
    overflow: 'hidden'
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.PILL_COLOR,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 6,
  },
  pillText: {
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_PRIMARY,
  },
  title: {
    marginTop: 5,
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  titleCompact: {
    marginTop: 5,
    fontSize: 18,
  },
  infoRow: {
    // marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  address: {
    marginTop: 5,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.TEXT_PRIMARY,
  },
  description: {
    marginTop: 5,
    fontSize: FONT_SIZE.TEXT,
    lineHeight: 22,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  descriptionCompact: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
  },
  statusBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: '#D0E6FB',
  },
  statusBannerWarning: {
    backgroundColor: '#FFF8E6',
    borderColor: '#F5D76E',
  },
  statusBannerSuccess: {
    backgroundColor: '#E8F8EF',
    borderColor: '#B8E6C8',
  },
  statusBannerText: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#E6B7AA',
  },
  primaryBtnText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  secondaryBtn: {
    marginTop: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    color: COLORS.BUTTON_COLOR,
  },
  removeBtn: {
    marginTop: 8,
    alignItems: 'center',
  },
  removeBtnText: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.LOGOUT_TEXT,
  },
});
