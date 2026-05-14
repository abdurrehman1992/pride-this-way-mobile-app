import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from "react-native";

import { MenuIcon, Notification } from "../../constants/icons";
import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
import { BgFrame } from "../../constants/images";

import {
  DrawerActions,
  useNavigation,
} from "@react-navigation/native";

interface Props {
  title: string;
}

const TopHeader: React.FC<Props> = ({ title }) => {
  const navigation = useNavigation();

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <ImageBackground
      source={BgFrame}
      style={styles.container}
      fadeDuration={0}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={openDrawer}
        >
          <MenuIcon width={33.75} height={33.75} />
        </TouchableOpacity>

        <Text style={styles.title}>{title}</Text>

        <View style={styles.notificationBtn}>
          <Notification width={19.5} height={20.58} />
        </View>
      </View>
    </ImageBackground>
  );
};

export default React.memo(TopHeader);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 136,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
    justifyContent: "flex-end",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    marginBottom: 25,
  },

  title: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.LARGE_TEXT,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
  },

  notificationBtn: {
    width: 43,
    height: 43,
    borderRadius: 43,
    backgroundColor: COLORS.WHITE,
    justifyContent: "center",
    alignItems: "center",
  },
});