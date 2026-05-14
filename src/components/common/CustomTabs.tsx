import React from 'react'
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView
} from 'react-native'
import { COLORS } from '../../constants/colors'
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts'
type TabItem = {
    label: string
    value: string
    icon?: React.ReactNode
}
type Props = {
    tabs: TabItem[]
    activeTab: string
    onChange: (val: string) => void
}
const CustomTabs: React.FC<Props> = ({ tabs, activeTab, onChange }) => {
    return (
        <View style={styles.wrapper}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.container}
            >
                {tabs.map((tab) => {
                    const isActive = tab.value === activeTab

                    return (
                        <TouchableOpacity
                            key={tab.value}
                            style={[
                                styles.tab,
                                isActive && styles.activeTab
                            ]}
                            onPress={() => onChange(tab.value)}
                            activeOpacity={0.7}
                        >
                            {tab.icon && <View style={styles.icon}>{tab.icon}</View>}

                            <Text
                                style={[
                                    styles.text,
                                    isActive && styles.activeText
                                ]}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    )
                })}
            </ScrollView>
        </View>
    )
}

export default CustomTabs

const styles = StyleSheet.create({
    wrapper: {
        marginTop: 0,
    },

    container: {
        paddingHorizontal: 24,
        paddingVertical: 8,
    },

    tab: {
        height: 31,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: COLORS.TABS_COLOR,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
    },

    activeTab: {
        backgroundColor: COLORS.BUTTON_COLOR,
    },

    text: {
        fontSize: FONT_SIZE.CARD_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_PRIMARY,
    },

    activeText: {
        color: COLORS.WHITE,
        fontFamily: FONT_FAMILY.InterTight_Medium,
    },

    icon: {
        marginRight: 6,
    },
})