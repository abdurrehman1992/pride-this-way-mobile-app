import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import ForgeTopHeader from '../../components/common/ForgeTopHeader';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import { Arrow, EmailIcon, WhatsappIcon } from '../../constants/icons'; // Use whichever icons fit support context
import { showError } from '../../components/common/AppToast';

const Support = () => {
  const handleContactMethod = async (
    type: "email" | "whatsapp"
  ) => {
    try {
      if (type === "email") {

        const email = "support@yourdomain.com";

        const subject =
          "Tour App Support Request";

        const url =
          `mailto:${email}?subject=${encodeURIComponent(subject)}`;

        await Linking.openURL(url);

        return;
      }

      if (type === "whatsapp") {
        const phoneNumber = "923001234567";

        const message =
          "Hello, I need help with my tours.";
        const whatsappUrl =
          `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
        const webUrl =
          `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

        try {

          await Linking.openURL(whatsappUrl);

        } catch {

          await Linking.openURL(webUrl);

        }

        return;
      }

    } catch (error) {

      // console.log("SUPPORT ERROR:", error);

      showError(
        "Action Failed",
        "This action is unavailable on your device."
      );
    }
  };

  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.top}>
          <ForgeTopHeader title="Support" />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.headingText}>How can we help you?</Text>
          <Text style={styles.subText}>Select one of our direct support channels below to get <Text style={{ color: COLORS.BUTTON_COLOR }}>PrideThisWay</Text> assistance.</Text>
        </View>

        <View style={styles.buttonContainer}>
          {/* Email Support Row */}
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleContactMethod('email')}
          >
            <View style={styles.left}>
              {/* Reusing icons with exact layout sizing */}
              <EmailIcon width={32} height={32} />
              <Text style={styles.buttonText}>Email Support</Text>
            </View>
            <Arrow width={18.25} />
          </TouchableOpacity>

          {/* WhatsApp Support Row */}
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleContactMethod('whatsapp')}
          >
            <View style={styles.left}>
              <WhatsappIcon width={32} height={32} />
              <Text style={styles.buttonText}>WhatsApp Support</Text>
            </View>
            <Arrow width={18.25} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
};

export default Support;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },

  top: {
    marginHorizontal: 24,
    marginTop: 16,
  },

  infoContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },

  headingText: {
    fontSize: 20,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    textAlign: 'center',
  },

  subText: {
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_Regular,
    textAlign: 'center',
    marginTop: 6,
  },

  button: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  left: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },

  buttonText: {
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: FONT_SIZE.LARGE_TEXT,
    color: COLORS.TEXT_PRIMARY,
  },

  buttonContainer: {
    marginHorizontal: 24,
    gap: 24,
    marginTop: 60,
  },
});