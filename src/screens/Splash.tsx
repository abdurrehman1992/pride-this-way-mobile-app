import React from "react";
import { View, ImageBackground, StyleSheet, StatusBar } from "react-native";
import SplashImage from "../assets/images/Splash.jpg";
const Splash: React.FC = () => {
  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <ImageBackground source={SplashImage} style={styles.container}>
        <View />
      </ImageBackground>
    </>
  );
};
export default Splash;
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});