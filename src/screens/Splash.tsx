import React from "react";
import { View, ImageBackground, StyleSheet } from "react-native";
import SplashImage from "../assets/images/Splash.jpg";
const Splash: React.FC = () => {
  return (
    <ImageBackground source={SplashImage} style={styles.container}>
      <View />
    </ImageBackground>
  );
};
export default Splash;
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});