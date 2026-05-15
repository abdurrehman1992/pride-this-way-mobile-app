import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ForgeTopHeader from "../../components/common/ForgeTopHeader";
import { CameraIcon, SinupIcon } from "../../constants/icons";
import { pickImageFromGallery } from "../../utils/imagePicker";
import { COLORS } from "../../constants/colors";
import { FONT_FAMILY } from "../../constants/fonts";
import { PROFILE_IMAGE } from "../../constants/images";
import CustomInput from "../../components/common/CustomInput";
import CustomButton from "../../components/common/CustomButton";
import {
    validateName,
    validateEmail,
    validatePhone
} from "../../utils/validation";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { showError, showSuccess } from "../../components/common/AppToast";
import { RootState } from "../../Redux/store";
import { loginSuccess } from "../../Redux/slices/authSlice";
import { updateCurrentUserProfile } from "../../services/authService";
const EditProfile = () => {
    const navigation = useNavigation<any>()
    const dispatch = useDispatch();
    const user = useSelector((state: RootState) => state.auth.user);
    const [image, setImage] = useState<string | null>(null);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({
        name: "",
        email: "",
        phone: ""
    });

    useEffect(() => {
        if (!user) return;

        setFullName(user.name || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
    }, [user]);

    const handlePickImage = async () => {
        const uri = await pickImageFromGallery();
        if (uri) setImage(uri);
    };
    const handleNameChange = (text: string) => {
        setFullName(text);
        setErrors(prev => ({
            ...prev,
            name: validateName(text)
        }));
    };

    const handleEmailChange = (text: string) => {
        setEmail(text);
        setErrors(prev => ({
            ...prev,
            email: validateEmail(text)
        }));
    };

    const handlePhoneChange = (text: string) => {
        setPhone(text);
        setErrors(prev => ({
            ...prev,
            phone: validatePhone(text)
        }));
    };
    const isFormValid = useMemo(() => {
        return (
            fullName.trim() !== "" &&
            email.trim() !== "" &&
            phone.trim() !== "" &&
            errors.name === "" &&
            errors.email === "" &&
            errors.phone === ""
        );
    }, [fullName, email, phone, errors]);

    const handleUpdateProfile = async () => {
        if (!isFormValid || loading) return;

        setLoading(true);

        try {
            const session = await updateCurrentUserProfile({
                fullName,
                email,
                phone,
            });

            dispatch(loginSuccess(session));
            showSuccess("Profile updated successfully");
            navigation.reset({
                index: 0,
                routes: [
                    {
                        name: 'Profile',
                    },
                ],
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unable to update profile.";
            showError("Update Failed", message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* HEADER */}
                    <View style={styles.up}>
                        <ForgeTopHeader title="Edit Profile" />
                    </View>

                    {/* PROFILE IMAGE */}
                    <View style={styles.profileSection}>
                        <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                            <Image
                                source={{ uri: image || PROFILE_IMAGE }}
                                style={styles.profileImage}
                            />
                            <CameraIcon width={35} height={35} style={styles.iconOverlay} />
                        </TouchableOpacity>

                        <Text style={styles.changeText}>
                            Change Profile Picture
                        </Text>
                    </View>

                    {/* INPUTS */}
                    <View style={styles.inputs}>
                        <CustomInput
                            label="Full Name"
                            placeholder="Enter Full Name"
                            value={fullName}
                            onChangeText={handleNameChange}
                            error={errors.name}
                        />

                        <CustomInput
                            label="Email Address"
                            placeholder="Enter Email Address"
                            value={email}
                            onChangeText={handleEmailChange}
                            keyboardType="email-address"
                            error={errors.email}
                        />

                        <CustomInput
                            label="Phone Number"
                            placeholder="Enter Phone Number"
                            value={phone}
                            onChangeText={handlePhoneChange}
                            keyboardType="phone-pad"
                            error={errors.phone}
                        />
                    </View>

                    {loading ? (
                        <ActivityIndicator
                            size="large"
                            color={COLORS.BUTTON_COLOR}
                            style={styles.loader}
                        />
                    ) : (
                        <CustomButton
                            title="Update Profile"
                            Icon={SinupIcon}
                            onPress={handleUpdateProfile}
                            disabled={!isFormValid}
                        />
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default EditProfile;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.BACKGROUND,
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    up: {
        marginTop: 16,
    },
    profileSection: {
        marginTop: 60,
        alignItems: "center",
    },
    profileImage: {
        width: 110,
        height: 110,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: COLORS.BUTTON_COLOR,
    },
    iconOverlay: {
        position: "absolute",
        bottom: 8,
        right: 0,
        backgroundColor: COLORS.WHITE,
        padding: 6,
        borderRadius: 20,
        elevation: 3,
    },
    changeText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.Poppins_Medium,
    },
    inputs: {
        marginTop: 40,
        gap: 10,
    },
    loader: {
        marginVertical: 20,
    },
});
