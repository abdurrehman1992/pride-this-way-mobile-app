import React, { useState, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform
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
import { showSuccess } from "../../components/common/AppToast";
const EditProfile = () => {
    const navigation = useNavigation<any>()
    const [image, setImage] = useState<string | null>(null);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [errors, setErrors] = useState({
        name: "",
        email: "",
        phone: ""
    });

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

    const handleUpdateProfile = () => {
        if (!isFormValid) return;
        console.log("Profile Updated:", {
            fullName,
            email,
            phone,
            image
        });
        showSuccess("Profile updated sucessfully")
        navigation.reset({
            index: 0,
            routes: [
                {
                    name: 'Profile',
                },
            ],
        });
        // navigation.navigate('')
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
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
                    <View style={{ marginTop: 40, gap: 10 }}>
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

                        <CustomButton
                            title="Update Profile"
                            Icon={SinupIcon}
                            onPress={handleUpdateProfile}
                            disabled={!isFormValid}
                            style={{
                                opacity: isFormValid ? 1 : 0.5
                            }}
                        />
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
});