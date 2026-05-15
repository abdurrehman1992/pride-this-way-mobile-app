import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import ForgeTopHeader from '../../components/common/ForgeTopHeader';
import { COLORS } from '../../constants/colors';
import { PLACES_ARROUND, RewardsBackground } from '../../constants/images';
import {
  CreatedTourLocationIcon,
  RewardIcon,
  IconUp,
  DownArrow,
  TourLocationIcon,
  TourDateIcon,
  EarnedPointIcon,
} from '../../constants/icons';

import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import { fetchRewardsSummary } from '../../services/myTourService';
import { RootState } from '../../Redux/store';

const Rewards = () => {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [showAll, setShowAll] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [rewards, setRewards] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchRewardsSummary(userId).then((summary) => {
        setTotalPoints(summary.totalPoints);
        setRewards(
          summary.tours.map((tour, index) => ({
            id: tour.id,
            name: tour.title,
            points: tour.points,
            totalLocations: tour.totalLocations,
            date: tour.date ? new Date(tour.date).toDateString().slice(4) : 'Active',
            isOpen: index === 0,
            places: tour.places,
          }))
        );
      });
    }, [userId])
  );

  const toggleCard = (id: number) => {
    setRewards(prev =>
      prev.map(item =>
        item.id === id ? { ...item, isOpen: !item.isOpen } : item,
      ),
    );
  };

  const visibleRewards = showAll ? rewards : rewards.slice(0, 2);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.up}>
          <ForgeTopHeader title="Rewards" />
        </View>
        <ImageBackground source={RewardsBackground} style={styles.bg}>
          <View style={styles.contentTop}>
            <RewardIcon width={33} height={33} />
            <Text style={styles.cardTitle}>{totalPoints.toLocaleString()} Points</Text>
          </View>

          <Text style={styles.textCongrats}>
            Great job! Explore more tours to earn additional rewards.
          </Text>

          <View style={styles.progressOuter}>
            <View style={styles.progressInner} />
          </View>

          <Text style={styles.textCongrats}>
            Next Reward Unlock at {Math.max(1500, totalPoints + 250).toLocaleString()} Points.
          </Text>
        </ImageBackground>
        <View style={styles.pointsTitleCont}>
          <Text style={styles.pointsTitle} numberOfLines={2}>
            Your Tours & Rewards
          </Text>

          <TouchableOpacity
            onPress={() => setShowAll(!showAll)}
            style={styles.seeAllButton}
          >
            <Text style={styles.seeAll}>
              {showAll ? 'Show Less' : 'See All'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.listContainer}>
          {visibleRewards.map(item => (
            <View key={item.id} style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleCard(item.id)}
                style={styles.cardTop}
              >
                <Image
                  source={{ uri: PLACES_ARROUND }}
                  style={styles.imagePlaceholder}
                />

                <View style={styles.cardInfo}>
                  <View style={styles.titleRow}>
                    <Text style={styles.tourTittle} numberOfLines={2}>
                      {item.name}
                    </Text>

                    <View style={styles.expandIcon}>
                      {item.isOpen ? (
                        <IconUp width={10.95} height={6.31} />
                      ) : (
                        <DownArrow width={16} height={16} />
                      )}
                    </View>
                  </View>

                  <View style={styles.metaInfoRow}>
                    <View style={styles.metaInfoItem}>
                      <TourLocationIcon height={20} width={20} />
                      <Text style={styles.textInfo}>
                        Visit {item.totalLocations} Locations
                      </Text>
                    </View>

                    <View style={styles.metaInfoItem}>
                      <TourDateIcon height={20} width={20} />
                      <Text style={styles.textInfo}>{item.date}</Text>
                    </View>
                  </View>

                  {/* POINTS */}
                  <View style={styles.metaInfoItem}>
                    <EarnedPointIcon height={20} width={20} />
                    <Text style={styles.textInfo}>
                      Earn <Text style={styles.textGreen}>+{item.points}</Text>{' '}
                      Points
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {item.isOpen && (
                <View style={styles.cardBottom}>
                  <Text style={styles.breakDownTitle}>Points Breakdown</Text>

                  {(item.places || []).map((place: any) => (
                    <View key={place.id} style={styles.locationCont}>
                      <View style={styles.locationRow}>
                        <CreatedTourLocationIcon width={18} height={18} />
                        <Text style={styles.locationText}>{place.name}</Text>
                      </View>
                      <Text style={styles.arrow}>{`---->`}</Text>
                      <Text style={styles.pointsText}>+{place.points} Points</Text>
                    </View>
                  ))}

                  <View style={styles.divider} />

                  <View style={styles.totalRow}>
                    <Text style={styles.totalText}>Total Points</Text>
                    <Text style={styles.totalPoints}>
                      +{item.points} Points
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Rewards;
const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    gap: 8,
  },
  expandIcon: {
    flexShrink: 0,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    marginHorizontal: 24,
    backgroundColor: COLORS.BACKGROUND,
  },
  arrow: {
    color: COLORS.CLEAR_ALL,
  },
  up: {
    marginTop: 16,
  },

  bg: {
    marginTop: 32,
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },

  contentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  cardTitle: {
    fontSize: FONT_SIZE.OTP_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },

  textCongrats: {
    fontFamily: FONT_FAMILY.InterTight_Regular,
    fontSize: FONT_SIZE.SMALL_TEXT,
    color: COLORS.TEXT_PRIMARY,
    marginTop: 7,
  },

  progressOuter: {
    height: 11,
    backgroundColor: '#FFFFFF37',
    borderRadius: 100,
    marginVertical: 14,
    justifyContent: 'center',
  },

  progressInner: {
    height: 11,
    backgroundColor: '#fff',
    borderRadius: 100,
    width: '55%',
  },

  pointsTitleCont: {
    marginVertical: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },

  pointsTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },

  seeAllButton: {
    flexShrink: 0,
    minHeight: 28,
    justifyContent: 'center',
  },

  seeAll: {
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: FONT_SIZE.TEXT,
    color: COLORS.CLEAR_ALL,
  },

  listContainer: {
    gap: 14,
    paddingBottom: 40,
  },

  // CARD
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 5,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 6,
    minWidth: 0,
  },

  metaInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  metaInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  metaText: {
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },

  pointText: {
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_PRIMARY,
  },

  green: {
    color: COLORS.TEXT_GREEN,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },

  // BOTTOM
  cardBottom: {
    marginTop: 12,
    backgroundColor: '#95D8EA20',
    padding: 12,
    borderRadius: 12,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },

  locationText: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_PRIMARY,
  },
  pointsText: {
    color: COLORS.TEXT_GREEN,
    fontFamily: FONT_FAMILY.Poppins_Medium,
    fontSize: FONT_SIZE.CARD_TEXT,
  },
  locationCont: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakDownTitle: {
    fontFamily: FONT_FAMILY.Poppins_Medium,
    fontSize: FONT_SIZE.SMALL_TEXT,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 10,
  },
  imagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 6.71,
  },
  tourTittle: {
    flex: 1,
    flexShrink: 1,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
  },
  textInfo: {
    fontSize: FONT_SIZE.CARD_TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
  textGreen: {
    color: COLORS.TEXT_GREEN,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 10,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalText: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },

  totalPoints: {
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_GREEN,
  },
});
