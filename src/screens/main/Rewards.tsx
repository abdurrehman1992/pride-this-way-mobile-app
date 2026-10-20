import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import ForgeTopHeader from '../../components/common/ForgeTopHeader';
import LoadingCards from '../../components/common/LoadingCards';
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
import { fetchRewardsSummary, RewardsSummary } from '../../services/myTourService';
import { RootState } from '../../Redux/store';

const RewardsLoading = () => (
  <View accessibilityLabel="Loading rewards">
    <View style={[styles.bg, styles.loadingSummary]}>
      <View style={styles.contentTop}>
        <View style={[styles.loadingBlock, styles.loadingIcon]} />
        <View style={[styles.loadingBlock, styles.loadingPoints]} />
      </View>
      <View style={[styles.loadingBlock, styles.loadingLine]} />
      <View style={[styles.loadingBlock, styles.loadingLineShort]} />
      <View style={[styles.loadingBlock, styles.loadingProgress]} />
      <View style={[styles.loadingBlock, styles.loadingLineShort]} />
    </View>
    <View style={styles.pointsTitleCont}>
      <View style={[styles.loadingBlock, styles.loadingSectionTitle]} />
    </View>
    <View style={styles.listContainer}>
      <LoadingCards count={2} />
    </View>
    <View style={styles.loadingCaption}>
      <ActivityIndicator size="small" color={COLORS.BUTTON_COLOR} />
      <Text style={styles.loadingCaptionText}>Loading your rewards...</Text>
    </View>
  </View>
);

const Rewards = () => {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [showAll, setShowAll] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [rewards, setRewards] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadRewards = useCallback(() => fetchRewardsSummary(userId), [userId]);

  const applyRewards = useCallback((summary: RewardsSummary) => {
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
    setHasLoaded(true);
    setLoadError(false);
  }, []);

  const nextUnlock = Math.max(1500, totalPoints + 250);
  const progressRatio = nextUnlock > 0 ? Math.min(1, totalPoints / nextUnlock) : 0;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadRewards()
        .then(summary => {
          if (active) applyRewards(summary);
        })
        .catch(() => {
          if (active) setLoadError(true);
        })
        .finally(() => {
          if (active) setInitialLoading(false);
        });
      return () => {
        active = false;
      };
    }, [loadRewards, applyRewards])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      applyRewards(await loadRewards());
    } catch {
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadRewards, applyRewards]);

  const handleRetry = useCallback(async () => {
    setInitialLoading(true);
    setLoadError(false);
    try {
      applyRewards(await loadRewards());
    } catch {
      setLoadError(true);
    } finally {
      setInitialLoading(false);
    }
  }, [loadRewards, applyRewards]);

  const toggleCard = (id: number) => {
    setRewards(prev =>
      prev.map(item =>
        item.id === id ? { ...item, isOpen: !item.isOpen } : item,
      ),
    );
  };

  const visibleRewards = showAll ? rewards : rewards.slice(0, 2);

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View style={styles.up}>
          <ForgeTopHeader title="Rewards" />
        </View>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            !initialLoading ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.BUTTON_COLOR}
              />
            ) : undefined
          }
        >
          {initialLoading && !hasLoaded ? (
            <RewardsLoading />
          ) : loadError && !hasLoaded ? (
            <View style={styles.errorState}>
              <RewardIcon width={40} height={40} />
              <Text style={styles.errorTitle}>Couldn't load rewards</Text>
              <Text style={styles.errorText}>Please check your connection and try again.</Text>
              <TouchableOpacity accessibilityRole="button" onPress={handleRetry} style={styles.retryButton}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
          {loadError ? (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={refreshing}
              onPress={handleRefresh}
              style={styles.refreshError}
            >
              <Text style={styles.refreshErrorText}>
                {refreshing ? 'Refreshing rewards...' : "Couldn't refresh rewards. Tap to retry."}
              </Text>
            </TouchableOpacity>
          ) : null}
          <ImageBackground source={RewardsBackground} style={styles.bg}>
            <View style={styles.contentTop}>
              <RewardIcon width={33} height={33} />
              <Text style={styles.cardTitle}>{totalPoints.toLocaleString()} Points</Text>
            </View>

            <Text style={styles.textCongrats}>
              {rewards.length > 0
                ? 'Great job! Explore more tours to earn additional rewards.'
                : 'Start a tour to begin earning rewards — your rewards will appear here after you start.'}
            </Text>

            <View style={styles.progressOuter}>
              <View style={[styles.progressInner, { width: `${Math.round(progressRatio * 100)}%` }]} />
            </View>

            <Text style={styles.textCongrats}>
              Next Reward Unlock at {Math.max(1500, totalPoints + 250).toLocaleString()} Points.
            </Text>
          </ImageBackground>
          <View style={styles.pointsTitleCont}>
            <Text style={styles.pointsTitle} numberOfLines={2}>
              Your Tours & Rewards
            </Text>

            {rewards.length > 2 ? (
              <TouchableOpacity
                onPress={() => setShowAll(!showAll)}
                style={styles.seeAllButton}
              >
                <Text style={styles.seeAll}>
                  {showAll ? 'Show Less' : 'See All'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.listContainer}>
            {visibleRewards.length === 0 ? (
              <Text style={styles.emptyText}>No rewards earned yet.</Text>
            ) : visibleRewards.map(item => (
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
                          <IconUp width={16} height={16} />
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
                        <Text style={styles.arrow}>→</Text>
                        <Text style={styles.pointsText} numberOfLines={1}>
                          +{place.points} Points
                        </Text>
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
          </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
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
    width: 28,
    flexShrink: 0,
    textAlign: 'center',
  },
  up: {
    marginTop: 16,
    minHeight: 43,
    backgroundColor: COLORS.BACKGROUND,
    zIndex: 1,
  },
  scroll: {
    flex: 1,
  },

  loadingSummary: {
    backgroundColor: '#DCEAF5',
  },
  loadingBlock: {
    backgroundColor: '#D9DDE2',
    borderRadius: 8,
  },
  loadingIcon: {
    width: 33,
    height: 33,
  },
  loadingPoints: {
    width: 120,
    height: 22,
    backgroundColor: '#FFFFFFA8',
  },
  loadingLine: {
    width: '88%',
    height: 12,
    marginTop: 17,
    backgroundColor: '#FFFFFFA8',
  },
  loadingLineShort: {
    width: '58%',
    height: 12,
    marginTop: 9,
    backgroundColor: '#FFFFFFA8',
  },
  loadingProgress: {
    width: '100%',
    height: 11,
    marginTop: 20,
    backgroundColor: '#FFFFFFA8',
  },
  loadingSectionTitle: {
    width: 190,
    height: 24,
  },
  loadingCaption: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingCaptionText: {
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: FONT_SIZE.CARD_TEXT,
  },
  errorState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 20,
    gap: 12,
  },
  errorTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    fontSize: FONT_SIZE.LARGE_TEXT,
  },
  errorText: {
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    fontSize: FONT_SIZE.TEXT,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.BUTTON_COLOR,
    borderRadius: 10,
  },
  retryText: {
    color: COLORS.WHITE,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    fontSize: FONT_SIZE.TEXT,
  },
  refreshError: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.WHITE,
  },
  refreshErrorText: {
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: FONT_SIZE.CARD_TEXT,
    textAlign: 'center',
  },

  bg: {
    marginTop: 16,
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
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },

  locationText: {
    flex: 1,
    flexShrink: 1,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_PRIMARY,
  },
  pointsText: {
    width: 82,
    flexShrink: 0,
    textAlign: 'right',
    color: COLORS.TEXT_GREEN,
    fontFamily: FONT_FAMILY.Poppins_Medium,
    fontSize: FONT_SIZE.CARD_TEXT,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    paddingVertical: 24,
  },
  locationCont: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
