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
    validatePhone
} from "../../utils/validation";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { showError, showSuccess } from "../../components/common/AppToast";
import { RootState } from "../../Redux/store";
import { loginSuccess } from "../../Redux/slices/authSlice";
import { updateCurrentUserProfile } from "../../services/authService";
import { uploadImageToCloudinary } from "../../services/cloudinaryService";
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
        phone: ""
    });

    useEffect(() => {
        if (!user) return;

        setFullName(user.name || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
        setImage(user.profileImage || null);
    }, [user]);

    const [uploadingImage, setUploadingImage] = useState(false);

    const handlePickImage = async () => {
        if (uploadingImage) return;
        const uri = await pickImageFromGallery();
        if (!uri) return;

        const isAlreadyRemote = uri.startsWith('http://') || uri.startsWith('https://');
        if (isAlreadyRemote) {
            setImage(uri);
            return;
        }

        setImage(uri);
        setUploadingImage(true);
        try {
            const { secureUrl } = await uploadImageToCloudinary(uri);
            setImage(secureUrl);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Image upload failed.';
            showError('Upload Failed', message);
            setImage(user?.profileImage || null);
        } finally {
            setUploadingImage(false);
        }
    };
    const handleNameChange = (text: string) => {
        setFullName(text);
        setErrors(prev => ({
            ...prev,
            name: validateName(text)
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
            errors.name === "" &&
            errors.phone === ""
        );
    }, [fullName, email, errors]);

    const handleUpdateProfile = async () => {
        if (!isFormValid || loading || uploadingImage) return;

        setLoading(true);

        try {
            const session = await updateCurrentUserProfile({
                fullName,
                email,
                phone,
                profileImage: image,
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
                        <TouchableOpacity
                            onPress={handlePickImage}
                            activeOpacity={0.8}
                            disabled={uploadingImage}
                        >
                            <Image
                                source={{ uri: image || PROFILE_IMAGE }}
                                style={styles.profileImage}
                            />
                            {uploadingImage ? (
                                <View style={styles.uploadOverlay}>
                                    <ActivityIndicator color={COLORS.WHITE} />
                                </View>
                            ) : (
                                <CameraIcon width={35} height={35} style={styles.iconOverlay} />
                            )}
                        </TouchableOpacity>

                        <Text style={styles.changeText}>
                            {uploadingImage ? 'Uploading…' : 'Change Profile Picture'}
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
                            placeholder="Email Address"
                            value={email}
                            onChangeText={() => {}}
                            keyboardType="email-address"
                            editable={false}
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
                            disabled={!isFormValid || uploadingImage}
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
        paddingBottom: 60,
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
    uploadOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 60,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
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
