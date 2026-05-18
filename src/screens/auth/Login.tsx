import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ImageBackground,
  Text,
  ScrollView,
  TouchableOpacity,
  Keyboard,
} from "react-native";

import { COLORS } from "../../constants/colors";
import { FONT_SIZE, FONT_FAMILY } from "../../constants/fonts";
import CustomInput from "../../components/common/CustomInput";
import CustomButton from "../../components/common/CustomButton";
import AuthBottomNavigation from "../../components/common/AuthBottomNavigation";
import { AppLogo, LoginIcon, RemeberMe, RemeberMeTick } from "../../constants/icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../types/types";
import { useDispatch } from "react-redux";
import {
  loginFailure,
  loginStart,
  loginSuccess,
} from "../../Redux/slices/authSlice";
import {
  validateLoginEmail,
  validateLoginPassword,
} from "../../utils/validation";
import {
  saveRememberEmail,
  clearRememberEmail,
  getRememberEmail,
} from "../../utils/rememberMe";
import { showError, showSuccess } from "../../components/common/AppToast";
import { loginUser } from "../../services/authService";

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, "Login">;

const Login: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  const isFormValid = useMemo(() => {
    return (
      validateLoginEmail(email) === "" &&
      validateLoginPassword(password) === ""
    );
  }, [email, password]);

  useEffect(() => {
    const loadEmail = async () => {
      const saved = await getRememberEmail();
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    };
    loadEmail();

    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleLogin = async () => {
    if (loading) return;

    const emailError = validateLoginEmail(email);
    const passwordError = validateLoginPassword(password);

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setLoading(true);
    dispatch(loginStart());

    try {
      const session = await loginUser({
        email,
        password,
      });

      if (rememberMe) {
        await saveRememberEmail(email.trim());
      } else {
        await clearRememberEmail();
      }

      dispatch(loginSuccess(session));

      showSuccess("Login Successful", "Welcome back!");
    } catch (error) {
      console.log("LOGIN ERROR:", error);
      const message =
        error instanceof Error ? error.message : "Unable to sign in.";
      dispatch(loginFailure(message));
      showError("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* <ImageBackground
        source={BackGroundImage}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      /> */}
      <View style={styles.logo}>
        <AppLogo width={200} height={153} />
      </View>
      <View style={styles.overlay}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: keyboardHeight,
          }}
        >
          <View>
            <View style={styles.signupText}>
              <Text style={styles.title}>Sign In</Text>
              <Text style={styles.subTitle}>
                Sign in to continue exploring places and experiences.
              </Text>
            </View>
          </View>
          <View style={styles.form}>
            <CustomInput
              label="Email Address"
              placeholder="Enter Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors((prev) => ({
                  ...prev,
                  email: validateLoginEmail(text),
                }));
              }}
              keyboardType="email-address"
              error={errors.email}
            />

            <CustomInput
              label="Password"
              placeholder="****************"
              secureTextEntry
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors((prev) => ({
                  ...prev,
                  password: validateLoginPassword(text),
                }));
              }}
              error={errors.password}
            />

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.rememberContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                {rememberMe ? (
                  <RemeberMeTick width={16} height={16} />
                ) : (
                  <RemeberMe width={16} height={16} />
                )}
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate("ForgetPassword")}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <CustomButton
              title="Sign In"
              Icon={LoginIcon}
              onPress={handleLogin}
              disabled={!isFormValid}
              loading={loading}
            />

            <AuthBottomNavigation
              text={"Don't have an account?"}
              btnText={"Sign up"}
              onpress={() => navigation.navigate("Signup")}
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default Login;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: COLORS.WHITE
  },
  logo: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginTop: 40
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    height: "75%",
    width: "100%",
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  signupText: {
    paddingHorizontal: 24,
    marginTop: 36,
    marginBottom: 34,
    gap: 8,
  },
  title: {
    fontSize: FONT_SIZE.TITLE,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
  },
  subTitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.TEXT,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
  form: {
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    alignItems: "center",
  },
  rememberContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 5, // Larger touch target
  },
  rememberText: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Regular,
  },
  forgotText: {
    fontSize: FONT_SIZE.SMALL_TEXT,
    color: COLORS.BUTTON_COLOR,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BUTTON_COLOR,
    lineHeight: FONT_SIZE.SMALL_TEXT,
  },
});
