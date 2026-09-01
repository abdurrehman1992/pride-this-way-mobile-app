import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Animated,
    Image,
} from 'react-native';
import { useAlert, AlertButton } from '../../context/AlertContext';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY } from '../../constants/fonts';
import {
    CrossIcon,
    DeleteWhiteIcon,
    LocationTrack,
    ModalDone,
    RouteIcon,
    TourCompletedIcon,
} from '../../constants/icons';
import { DoneModalIcon } from '../../constants/images';

type AlertTone = 'success' | 'danger' | 'warning' | 'location' | 'tour' | 'info';

const getAlertTone = (title = '', buttons: AlertButton[] = []): AlertTone => {
    const normalizedTitle = title.toLowerCase();
    const hasDestructiveAction = buttons.some((button) => button.style === 'destructive');

    if (normalizedTitle.includes('success') || normalizedTitle.includes('confirmed') || normalizedTitle.includes('completed')) {
        return 'success';
    }

    if (normalizedTitle.includes('permission') || normalizedTitle.includes('location')) {
        return 'location';
    }

    if (hasDestructiveAction || normalizedTitle.includes('delete') || normalizedTitle.includes('discard') || normalizedTitle.includes('logout')) {
        return 'danger';
    }

    if (normalizedTitle.includes('error') || normalizedTitle.includes('failed') || normalizedTitle.includes('leave') || normalizedTitle.includes('end')) {
        return 'warning';
    }

    if (normalizedTitle.includes('tour')) {
        return 'tour';
    }

    return 'info';
};

const iconWrapperStyles = {
    success: 'successIconWrapper',
    danger: 'dangerIconWrapper',
    warning: 'warningIconWrapper',
    location: 'locationIconWrapper',
    tour: 'tourIconWrapper',
    info: 'infoIconWrapper',
} as const;

const renderAlertIcon = (tone: AlertTone) => {
    switch (tone) {
        case 'success':
            return <Image source={DoneModalIcon} style={styles.imageIcon} resizeMode="contain" />;
        case 'danger':
            return <DeleteWhiteIcon width={36} height={36} />;
        case 'location':
            return <LocationTrack width={42} height={42} />;
        case 'tour':
            return <TourCompletedIcon width={42} height={42} />;
        case 'warning':
            return <RouteIcon width={40} height={40} />;
        default:
            return <ModalDone width={42} height={42} />;
    }
};

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
    const tone = getAlertTone(alert?.title, alert?.buttons || []);
    const showCloseButton = !!cancelButton;
    const shouldShowCancelAsPrimary =
        !!cancelButton &&
        otherButtons.length === 0 &&
        !/cancel|stay/i.test(cancelButton.text);

    return (
        <Modal
            visible={!!alert}
            transparent
            animationType="fade"
            presentationStyle="overFullScreen"
            statusBarTranslucent={true}
            onRequestClose={hideAlert}
        >
            <View style={styles.overlay}>
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
                        <View style={[styles.iconWrapper, styles[iconWrapperStyles[tone]]]}>
                            {renderAlertIcon(tone)}
                        </View>

                        {showCloseButton && (
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={hideAlert}
                                disabled={loading !== null}
                            >
                                <CrossIcon width={15} height={15} />
                            </TouchableOpacity>
                        )}

                        {alert?.title && (
                            <Text style={styles.alertTitle}>{alert.title}</Text>
                        )}
                        {alert?.message && (
                            <Text style={styles.alertMessage}>{alert.message}</Text>
                        )}

                        <View style={styles.buttonContainer}>
                            {cancelButton && (
                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        shouldShowCancelAsPrimary ? styles.buttonPrimaryWrap : styles.cancelAction,
                                        otherButtons.length === 0 && styles.fullWidthButton,
                                    ]}
                                    onPress={() => handleButtonPress(cancelButton)}
                                    disabled={loading !== null}
                                >
                                    {loading === cancelButton.text ? (
                                        <ActivityIndicator
                                            size="small"
                                            color={shouldShowCancelAsPrimary ? COLORS.WHITE : COLORS.TEXT_PRIMARY}
                                        />
                                    ) : (
                                        <Text style={shouldShowCancelAsPrimary ? styles.primaryButtonText : styles.cancelActionText}>
                                            {cancelButton.text}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}

                            {otherButtons.map((button, index) => {
                                const isDestructive = button.style === 'destructive';
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.actionButton,
                                            isDestructive ? styles.destructiveButtonRed : styles.buttonPrimaryWrap,
                                            !cancelButton && styles.fullWidthButton,
                                        ]}
                                        onPress={() => handleButtonPress(button)}
                                        disabled={loading !== null}
                                    >
                                        {loading === button.text ? (
                                            <ActivityIndicator
                                                size="small"
                                                color={isDestructive ? COLORS.WHITE : COLORS.WHITE}
                                            />
                                        ) : (
                                            <Text
                                                style={isDestructive ? styles.destructiveButtonTextSolid : styles.primaryButtonText}
                                            >
                                                {button.text}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    alertContainer: {
        width: '100%',
        maxWidth: 390,
    },
    alertBox: {
        backgroundColor: COLORS.WHITE,
        borderRadius: 32,
        paddingTop: 94,
        paddingBottom: 25,
        paddingHorizontal: 20,
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.22,
        shadowRadius: 26,
        elevation: 12,
    },
    iconWrapper: {
        position: 'absolute',
        top: -45,
        width: 90,
        height: 90,
        borderRadius: 45,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 8,
        borderColor: COLORS.WHITE,
        zIndex: 2,
    },
    imageIcon: {
        width: 90,
        height: 90,
    },
    successIconWrapper: {
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    dangerIconWrapper: {
        backgroundColor: '#DE3D45',
    },
    warningIconWrapper: {
        backgroundColor: '#FFF3D6',
    },
    locationIconWrapper: {
        backgroundColor: '#E8F7F3',
    },
    tourIconWrapper: {
        backgroundColor: '#E9F4FF',
    },
    infoIconWrapper: {
        backgroundColor: '#E9F4FF',
    },
    closeButton: {
        position: 'absolute',
        top: 25,
        right: 25,
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertTitle: {
        fontSize: 24,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: '#101828',
        marginBottom: 12,
        textAlign: 'center',
    },
    alertMessage: {
        fontSize: 16,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: '#667085',
        marginBottom: 28,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 320,
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        minHeight: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    destructiveButtonRed: {
        backgroundColor: '#DE3D45',
    },
    destructiveButtonTextSolid: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        textAlign: 'center',
    },
    buttonPrimaryWrap: {
        backgroundColor: COLORS.BUTTON_COLOR,
        shadowColor: COLORS.BUTTON_COLOR,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
    },
    primaryButtonText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        textAlign: 'center',
    },
    cancelAction: {
        backgroundColor: COLORS.WHITE,
        borderWidth: 1,
        borderColor: '#D0D5DD',
    },
    cancelActionText: {
        color: '#101828',
        fontSize: 16,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        textAlign: 'center',
    },
    fullWidthButton: {
        flex: 0,
        width: '100%',
    },
});
