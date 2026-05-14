import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from "react-native";
import React from "react";
import { COLORS } from "../../constants/colors";
import TopHeader from "../../components/Home/TopHeader";
import CustomSearchInput from "../../components/Home/CustomSearchInput";
import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT } from "../../constants/fonts";
import PlacesArroundCard from "../../components/Home/PlacesArroundCard";
import RecommendedForYou from "../../components/Home/RecommendedForYou";
import { FilterIcon } from "../../constants/images";
import { useNavigation } from "@react-navigation/native";
const Home: React.FC = () => {
  const navigation = useNavigation<any>();
  const horizontalData = [
    {
      id: "place_1",
      title: "Beach Party",
      description: "Fun night at beach",
      rating: "4.5",
      image: "https://picsum.photos/200",
      category: "Event",
    },
    {
      id: "place_2",
      title: "Music Night",
      description: "Live band show",
      rating: "4.7",
      image: "https://picsum.photos/201",
      category: "Music",
    },
    {
      id: "place_3",
      title: "Food Festival",
      description: "Street food event",
      rating: "4.8",
      image: "https://picsum.photos/202",
      category: "Food",
    },
  ];
  const recommendedData = [
    {
      id: "rec_1",
      title: "Skyline Rooftop Dining",
      description: "Enjoy food with stunning city views",
      rating: "4.7",
      image: "https://picsum.photos/210",
      category: "Restaurant",
    },
    {
      id: "rec_2",
      title: "Jazz Night",
      description: "Live jazz experience",
      rating: "4.6",
      image: "https://picsum.photos/211",
      category: "Music",
    },
  ];
  return (
    <View style={styles.container}>
      <TopHeader title={"Recommendations"} />
      <FlatList
        data={recommendedData}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RecommendedForYou
            id={item.id}
            title={item.title}
            description={item.description}
            rating={item.rating}
            image={item.image}
            onPress={() => navigation.navigate("RecommendationDetials")}

          />
        )}
        ListHeaderComponent={
          <>
            <View style={{ paddingHorizontal: 24 }}>
              <CustomSearchInput rightIcon={<Image source={FilterIcon} width={23} height={17.07} />} />
            </View>
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>
                  Places Around You
                </Text>
                <Text style={styles.seeAllText}>See All</Text>
              </View>
              <FlatList
                data={horizontalData}
                horizontal
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => (
                  <PlacesArroundCard
                    id={item.id}
                    title={item.title}
                    description={item.description}
                    rating={item.rating}
                    image={item.image}
                    width={295}
                  />
                )}
              />
            </View>
            <View style={{ marginTop: 30 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>
                  Recommended For You
                </Text>
                <Text style={[styles.seeAllText, { color: "#EA673F" }]}>
                  See All
                </Text>
              </View>
            </View>
          </>
        }
        contentContainerStyle={{
          flexGrow: 1,
        }}
      />
    </View>
  );
};
export default Home;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 22
  },
  sectionHeaderText: {
    fontSize: FONT_SIZE.LARGE_TEXT,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
  },
  seeAllText: {
    fontSize: FONT_SIZE.TEXT,
    color: COLORS.BUTTON_COLOR,
    fontFamily: FONT_FAMILY.InterTight_Medium
  },
  listContainer: {
    paddingHorizontal: 24,
    gap: 14,
  },
});