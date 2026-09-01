import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { CrossIcon } from "../../constants/icons";
import { NameTourIcon } from "../../constants/images";
import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";

interface Props {
  visible: boolean;
  tourName: string;
  setTourName: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onUpdateLater?: () => void;
}

const NameTourModal: React.FC<Props> = ({
  visible,
  tourName,
  setTourName,
  onClose,
  onConfirm,
  onUpdateLater,
}) => {
  // const keyboardOffset = Platform.OS === "ios" ? 20 : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        // keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView contentContainerStyle={styles.centerOverlay} keyboardShouldPersistTaps="handled">
          <View style={styles.nameModalPopup}>
          <View style={styles.floatingImageWrapper}>
            <Image source={NameTourIcon} style={styles.floatingImage} />
          </View>
          <TouchableOpacity style={styles.nameModalClose} onPress={onClose}>
            <CrossIcon width={12} height={12} />
          </TouchableOpacity>
          <Text style={styles.nameModalTitle}>Name this Tour</Text>
          <Text style={styles.nameModalDesc}>Give your adventure a catchy name to save it to your list and easily find it later.</Text>

          <TextInput
            placeholder="e.g. Weekend in USA, Food Walk, etc."
            style={styles.nameInput}
            placeholderTextColor={COLORS.TEXT_PRIMARY}
            value={tourName}
            onChangeText={setTourName}
            numberOfLines={1}
            multiline={false}
            textAlignVertical="center"
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          />

          <View style={styles.nameModalButtonRow}>
            <TouchableOpacity style={styles.updateLaterBtn} onPress={onUpdateLater || onClose}>
              <Text style={styles.updateLaterText}>Update this Later</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmTourBtn} onPress={onConfirm}>
              <Text style={styles.btnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default NameTourModal;

const styles = StyleSheet.create({
    centerOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.4)", // optional but recommended for modal UX
    },
    nameModalPopup: {
        width: "88%",
        maxWidth: 360,
        backgroundColor: COLORS.WHITE,
        borderRadius: 19,
        padding: 24,
        alignItems: "center",
        position: "relative",
    },
    floatingImageWrapper: {
        position: "absolute",
        top: -40,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 10,
    },

    floatingImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    nameModalClose: {
        position: "absolute",
        top: 25,
        right: 20,
        zIndex: 10,
    },
    nameModalTitle: {
        marginTop: 20,
        marginBottom: 12,
        fontSize: FONT_SIZE.LARGE_TEXT,
        fontFamily: FONT_FAMILY.Poppins_SemiBold,
        color: COLORS.TEXT_PRIMARY,
    },

    nameModalDesc: {
        marginBottom: 24,
        fontSize: FONT_SIZE.SMALL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_SECONDARY,
        textAlign: "center",
        lineHeight: 20,
    },
    nameInput: {
        width: "100%",
        height: 47,
        marginBottom: 24,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderRadius: 12,
        borderColor: COLORS.MODAL_INPUT_COLOR,
        fontSize: 15,
        fontFamily: FONT_FAMILY.InterTight_Regular,
        color: COLORS.TEXT_PRIMARY,
        includeFontPadding: false,
    },
    nameModalButtonRow: {
        flexDirection: "row",
        width: "100%",
        gap: 6,
        marginTop: 6,
        justifyContent: "center",
    },

    updateLaterBtn: {
        flex: 1,
        height: 50,
        borderRadius: 40,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal:5,
        paddingLeft:10
    },

    updateLaterText: {
        fontSize: FONT_SIZE.SMALL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_Medium,
        color: COLORS.TEXT_PRIMARY,
        // paddingHorizontal:16
    },

    confirmTourBtn: {
        flex: 1,
        height: 50,
        borderRadius: 40,
        backgroundColor: COLORS.BUTTON_COLOR,
        justifyContent: "center",
        alignItems: "center",
        fontSize:FONT_SIZE.SMALL_TEXT
    },

    btnText: {
        fontSize: FONT_SIZE.SMALL_TEXT,
        fontFamily: FONT_FAMILY.InterTight_SemiBold,
        color: COLORS.WHITE,
    },
});
