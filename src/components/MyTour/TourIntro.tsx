import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { MapIconMain } from '../../constants/icons';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';

interface TourIntroProps {
    onCreate: () => void;
    bottomInset?: number;
    refreshing?: boolean;
    onRefresh?: () => void;
    ctaLabel?: string;
    showHeader?: boolean;
}

const TourIntro: React.FC<TourIntroProps> = ({
    onCreate,
    bottomInset = 40,
    refreshing,
    onRefresh,
    ctaLabel = 'Create A Tour',
    showHeader = true,
}) => {
    return (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            refreshControl={
                onRefresh ? (
                    <RefreshControl
                        refreshing={!!refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.BUTTON_COLOR}
                    />
                ) : undefined
            }
        >
            <View style={[styles.content, { paddingBottom: bottomInset }]}>
                <MapIconMain width={190} height={121.32} />

                {showHeader ? (
                    <>
                        <Text style={styles.noTours}>No Tours Yet</Text>

                        <Text style={styles.desc}>
                            You haven&apos;t planned any adventures. Create your first tour to
                            start exploring the city.
                        </Text>
                    </>
                ) : null}

                <TouchableOpacity style={styles.btnContainer} onPress={onCreate} activeOpacity={0.85}>
                    <Text style={styles.btn}>{ctaLabel}</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

export default TourIntro;

const styles = StyleSheet.create({
    scroll: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        marginTop: 80,
        paddingHorizontal: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noTours: {
        marginTop: 30,
        fontSize: FONT_SIZE.LARGE_TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },
    desc: {
        marginTop: 14,
        maxWidth: 327,
        textAlign: 'center',
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
    },
    btnContainer: {
        marginTop: 28,
        paddingHorizontal: 52,
        height: 50,
        borderRadius: 40,
        backgroundColor: COLORS.BUTTON_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btn: {
        color: COLORS.WHITE,
        fontSize: FONT_SIZE.TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
    },
});
