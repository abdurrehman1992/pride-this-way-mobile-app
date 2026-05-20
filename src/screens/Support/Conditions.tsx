import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import ForgeTopHeader from '../../components/common/ForgeTopHeader';
import { FONT_FAMILY } from '../../constants/fonts';

const Conditions = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <ForgeTopHeader title="Terms & Conditions" />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.lastUpdated}>Last Updated: May 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>1. Acceptance of Terms</Text>
          <Text style={styles.bodyText}>
            By accessing and using this application, you agree to be bound by these Terms and Conditions. 
            If you do not agree with any part of these terms, you must not use or access the services provided.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>2. User Accounts</Text>
          <Text style={styles.bodyText}>
            To utilize certain personalized features or save tour routes, you may be required to register 
            an account. You are solely responsible for maintaining the confidentiality of your account credentials 
            and for all activities that occur under your account.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>3. Usage of Services</Text>
          <Text style={styles.bodyText}>
            This application generates recommended routes and itineraries for recreational and exploration purposes. 
            Users assume all liability and safety risks while following physical routes, traveling, or visiting 
            locations provided by our mapping services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>4. Intellectual Property</Text>
          <Text style={styles.bodyText}>
            All source code, layouts, design elements, graphics, logos, and generated tour details are the 
            intellectual property of the application developers and are protected by applicable trademark 
            and copyright regulations.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Conditions;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },

  top: {
    marginHorizontal: 24,
    marginTop: 16,
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },

  lastUpdated: {
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_Regular,
    opacity: 0.6,
    marginBottom: 24,
  },

  section: {
    marginBottom: 28,
  },

  sectionHeading: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    marginBottom: 8,
  },

  bodyText: {
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_Regular,
    lineHeight: 22,
    opacity: 0.85,
    textAlign: 'justify',
  },
});