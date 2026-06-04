import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Animated,
    Platform,
} from 'react-native';
import { useAlert, AlertButton } from '../../context/AlertContext';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';

const CustomAlertModal: React.FC = () => {
    const { alert, hideAlert } = useAlert();
    const [loading, setLoading] = useState<string | null>(null);
    const scaleAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (alert) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();
        } else {
            scaleAnim.setValue(0);
        }
    }, [alert, scaleAnim]);

    const handleButtonPress = async (button: AlertButton) => {
        setLoading(button.text);
        try {
            if (button.onPress) {
                await button.onPress();
            }
        } finally {
            setLoading(null);
            hideAlert();
        }
    };

    const cancelButton = alert?.buttons.find((btn) => btn.style === 'cancel');
    const otherButtons = alert?.buttons.filter((btn) => btn.style !== 'cancel') || [];

    return (
        <Modal
            visible={!!alert}
            transparent
            animationType="fade"
            onRequestClose={hideAlert}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    activeOpacity={1}
                    style={StyleSheet.absoluteFill}
                    onPress={hideAlert}
                />

                <Animated.View
                    style={[
                        styles.alertContainer,
                        {
                            transform: [
                                {
                                    scale: scaleAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.7, 1],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <View style={styles.alertBox}>
                        {alert?.title && (
                            <Text style={styles.alertTitle}>{alert.title}</Text>
                        )}
                        {alert?.message && (
                            <Text style={styles.alertMessage}>{alert.message}</Text>
                        )}

                        <View style={styles.buttonContainer}>
                            {otherButtons.map((button, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.button,
                                        {
                                            borderBottomWidth:
                                                index !== otherButtons.length - 1 ||
                                                    (cancelButton && otherButtons.length > 0)
                                                    ? 1
                                                    : 0,
                                        },
                                        button.style === 'destructive' && styles.destructiveButton,
                                    ]}
                                    onPress={() => handleButtonPress(button)}
                                    disabled={loading !== null}
                                >
                                    {loading === button.text ? (
                                        <ActivityIndicator
                                            size="small"
                                            color={
                                                button.style === 'destructive'
                                                    ? '#DC2626'
                                                    : COLORS.BUTTON_COLOR
                                            }
                                        />
                                    ) : (
                                        <Text
                                            style={[
                                                styles.buttonText,
                                                button.style === 'destructive' &&
                                                styles.destructiveButtonText,
                                            ]}
                                        >
                                            {button.text}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}

                            {cancelButton && (
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton]}
                                    onPress={() => handleButtonPress(cancelButton)}
                                    disabled={loading !== null}
                                >
                                    {loading === cancelButton.text ? (
                                        <ActivityIndicator size="small" color={COLORS.TEXT_PRIMARY} />
                                    ) : (
                                        <Text style={[styles.buttonText, styles.cancelButtonText]}>
                                            {cancelButton.text}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

export default CustomAlertModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    alertContainer: {
        width: '100%',
        maxWidth: 320,
    },
    alertBox: {
        backgroundColor: COLORS.WHITE,
        borderRadius: 14,
        // paddingVertical: 16,
        paddingTop: 16,
        paddingBottom:6,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    alertTitle: {
        fontSize: FONT_SIZE.LARGE_TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        color: COLORS.TEXT_PRIMARY,
        marginBottom: 8,
        textAlign: 'center',
    },
    alertMessage: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_PRIMARY,
        marginBottom: 16,
        textAlign: 'center',
        lineHeight: 20,
    },
    buttonContainer: {
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
        marginHorizontal: -16,
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomColor: '#E5E5E5',
        minHeight: 44,
    },
    buttonText: {
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        color: COLORS.BUTTON_COLOR,
        textAlign: 'center',
    },
    cancelButton: {
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
    },
    cancelButtonText: {
        color: COLORS.TEXT_PRIMARY,
        fontFamily: FONT_FAMILY.InterTight_Medium,
    },
    destructiveButton: {
        backgroundColor: 'transparent',
    },
    destructiveButtonText: {
        color: '#DC2626',
    },
});
