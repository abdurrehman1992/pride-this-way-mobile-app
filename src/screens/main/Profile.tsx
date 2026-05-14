import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/colors'
import ForgeTopHeader from '../../components/common/ForgeTopHeader'
import { PROFILE_IMAGE } from '../../constants/images'
import { Arrow, ChangePasswordIcon, EditProfileIcon, LogoutIcon } from '../../constants/icons'
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts'
import { logout } from "../../Redux/slices/authSlice";
import { useDispatch } from "react-redux";
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ProfileStackParamList } from '../../types/types'
type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "EditProfile">;

const Profile = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useDispatch();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <ForgeTopHeader title="Profile" />
      </View>
      <View style={styles.profileContainer}>
        <Image
          source={{
            uri: PROFILE_IMAGE
          }}
          style={styles.profileImage}
        />
        <Text style={styles.name}>Michael Smith</Text>
        <Text style={styles.email}>michaelsmith@gmail.com</Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <View style={styles.left}>
            <EditProfileIcon width={46.94} height={46.94} />
            <Text style={styles.buttonText}>Edit Profile</Text>
          </View>
          <Arrow width={18.25} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}
        onPress={()=>navigation.navigate('ChangePassword')}
        >
          <View style={styles.left}>
            <ChangePasswordIcon width={46.94} height={46.94} />
            <Text style={styles.buttonText}>Change Password</Text>
          </View>
          <Arrow width={18.25} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.logoutBtn}
        onPress={() => dispatch(
          logout()
        )}
      >
        <LogoutIcon width={36} height={36} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

export default Profile
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },

  top: {
    marginHorizontal: 24,
    marginTop: 16,
  },

  profileContainer: {
    // flex: 1,
    alignItems: 'center',
    marginTop: 60,
    // justifyContent: 'center',
    paddingHorizontal: 24,
  },

  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: COLORS.BUTTON_COLOR,
    marginBottom: 16,
  },

  name: {
    fontSize: 20,
    color: COLORS.TEXT_PRIMARY,
    fontFamily:FONT_FAMILY.Poppins_SemiBold,
    // marginBottom: 6,
  },

  email: {
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    fontFamily:FONT_FAMILY.Poppins_Regular
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
    gap: 16
  },
  buttonText: {
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: FONT_SIZE.LARGE_TEXT
  },
  buttonContainer: {
    marginHorizontal: 24,
    gap: 24,
    marginTop: 60
  },
  logoutBtn: {
    marginTop: 36,
    backgroundColor: COLORS.LOUGOUT_COLOR,
    marginHorizontal: 24,
    marginBottom: 32,
    padding: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  logoutText: {
    color: COLORS.LOGOUT_TEXT,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
})