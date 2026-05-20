import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import ForgeTopHeader from '../../components/common/ForgeTopHeader';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import { Arrow, EditProfileIcon, ChangePasswordIcon, EmailIcon, WhatsappIcon } from '../../constants/icons'; // Use whichever icons fit support context
import { showError } from '../../components/common/AppToast';

const Support = () => {
  
  const handleContactMethod = async (type: 'email' | 'whatsapp') => {
    let url = '';
    if (type === 'email') {
      url = 'mailto:support@yourdomain.com?subject=Tour App Support Request';
    } else if (type === 'whatsapp') {
      url = 'https://wa.me/1234567890?text=Hello,%20I%20need%20help%20with%20my%20tours.';
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showError('Action Failed', 'This channel is unavailable on your device.');
      }
    } catch {
      showError('Error', 'Could not open the communication link.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <ForgeTopHeader title="Support" />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.headingText}>How can we help you?</Text>
        <Text style={styles.subText}>Select one of our direct support channels below to get <Text style={{color:COLORS.BUTTON_COLOR}}>PrideThisWay</Text> assistance.</Text>
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