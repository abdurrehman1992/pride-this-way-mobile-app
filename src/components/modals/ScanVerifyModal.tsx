import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  ActivityIndicator,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { COLORS } from "../../constants/colors";
import { FONT_FAMILY, FONT_SIZE } from "../../constants/fonts";
import { CrossIcon } from "../../constants/icons";
import { CameraIcon, DoneModalIcon } from "../../constants/images";
type Props = {
  visible: boolean;
  title?: string;
  successPoints?: number;
  onClose: () => void;
  onScanSuccess: (imageUri: string) => boolean | Promise<boolean>;
};

type StepType = "scan" | "confirm" | "success";

const ScanVerifyModal: React.FC<Props> = ({
  visible,
  title,
  successPoints = 10,
  onClose,
  onScanSuccess,
}) => {
  const [step, setStep] = useState<StepType>("scan");
  const [capturedImage, setCapturedImage] = useState<{ uri: string } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<any>(null);
  const scanAnim = useRef(new Animated.Value(0)).current;

  /* eslint-disable no-bitwise */
  const encodeArrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    const enc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    let base64 = "";
    let i = 0;

    while (i < binary.length) {
      const [chr1, chr2, chr3] = [
        binary.charCodeAt(i++),
        binary.charCodeAt(i++),
        binary.charCodeAt(i++),
      ];

      const triple = (chr1 << 16) | (chr2 << 8) | chr3;
      base64 += enc[(triple >> 18) & 0x3f];
      base64 += enc[(triple >> 12) & 0x3f];
      base64 += isNaN(chr2) ? "=" : enc[(triple >> 6) & 0x3f];
      base64 += isNaN(chr3) ? "=" : enc[triple & 0x3f];
    }

    return base64;
  };
  /* eslint-enable no-bitwise */

  const imageToDataUri = async (image: any) => {
    if (typeof image.toEncodedImageDataAsync !== "function") {
      throw new Error("Snapshot image cannot be encoded to JPEG");
    }

    const encoded = await image.toEncodedImageDataAsync("jpg", 80);
    const base64 = encodeArrayBufferToBase64(encoded.buffer);
    if (typeof image.dispose === "function") {
      image.dispose();
    }
    return `data:image/jpeg;base64,${base64}`;
  };
  useEffect(() => {
    if (visible) {
      (async () => {
        try {
          setPermissionError(null);
          await requestPermission();
        } catch (err: any) {
          console.warn('Camera permission request failed', err);
          setPermissionError(
            'Camera access is required to verify your visit. Please enable it in Settings.'
          );
        }
      })();
    }
  }, [requestPermission, visible]);

  useEffect(() => {
    console.log('ScanVerifyModal state', { visible, hasPermission, deviceAvailable: !!device, step, permissionError });
  }, [visible, hasPermission, device, step, permissionError]);

  useEffect(() => {
    if (device && hasPermission && visible && step === "scan") {
      const timer = setTimeout(() => {
        // console.log("Camera is ready");
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [device, hasPermission, step, visible]);
  useEffect(() => {
    if (!visible) {
      setCapturedImage(null);
      setStep("scan");
    }
  }, [visible]);

  useEffect(() => {
    if (visible && step === "scan") {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 180,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [scanAnim, step, visible]);

  const handleScanPress = async () => {
    if (!cameraRef.current) {
      console.error("Camera ref is not available");
      return;
    }

    try {
      setIsCapturing(true);
      // console.log("Attempting to take photo...");

      const ref: any = cameraRef.current;
      if (!ref) {
        console.error("Camera ref is not available");
        return;
      }

      let photo: any = null;
      if (typeof ref.takePhoto === "function") {
        photo = await ref.takePhoto({
          qualityPrioritization: "speed",
          flash: "off",
        });
      } else if (typeof ref.takeSnapshot === "function") {
        photo = await ref.takeSnapshot();
      } else {
        console.error("No capture method available on camera ref", Object.keys(ref));
        return;
      }

      // console.log("Capture response:", photo);
      const rawPath = photo?.filePath || photo?.path || photo?.uri;
      if (rawPath) {
        const uri = rawPath.startsWith("file://") || rawPath.startsWith("content://")
          ? rawPath
          : `file://${rawPath}`;

        // console.log("Resolved capture URI:", uri);
        setCapturedImage({ uri });
        setStep("confirm");
        return;
      }

      if (photo && typeof photo.toEncodedImageDataAsync === "function") {
        try {
          const uri = await imageToDataUri(photo);
          // console.log("Resolved snapshot URI:", uri);
          setCapturedImage({ uri });
          setStep("confirm");
          return;
        } catch (encodeError) {
          console.error("Failed to encode snapshot image:", encodeError);
        }
      }

      if (typeof photo === "string") {
        const uri = photo.startsWith("file://") || photo.startsWith("content://") ? photo : `file://${photo}`;
        setCapturedImage({ uri });
        setStep("confirm");
        return;
      }

      console.error("Capture did not return filePath/path/uri", photo);
    } catch (error) {
      console.error("Failed to take photo:", error);
    } finally {
      setIsCapturing(false);
    }
  };
  const handleConfirmYes = async () => {
    if (!capturedImage?.uri) {
      return;
    }

    try {
      setIsCapturing(true);
      const isVerified = await onScanSuccess(capturedImage.uri);
      if (!isVerified) {
        return;
      }
      setStep("success");
    } finally {
      setIsCapturing(false);
    }
  };
  const handleConfirmNo = () => {
    setCapturedImage(null);
    setStep("scan");
  };

  const handleBackToTour = () => {
    setStep("scan");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {step === "scan" && (
          <View style={styles.card}>
            <View style={styles.imageWrapper}>
              <Image
                source={CameraIcon}
                style={styles.image}
                resizeMode="contain"
              />
              {/* <VisionCameraIcon width={83.11} height={83.11} 
                style={styles.image}
              /> */}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <CrossIcon width={12.43} height={12.43} />
            </TouchableOpacity>
            <Text style={styles.title}>Scan to Verify Your Visit</Text>
            <Text style={styles.description}>
              Scan a specific landmark or image to verify your visit to {title || "this location"}.
            </Text>
            <View style={styles.scanContainer}>
              <View style={styles.innerFrame}>
                <View style={styles.cameraWrapper}>
                  {device && hasPermission ? (
                    <Camera
                      ref={cameraRef}
                      style={StyleSheet.absoluteFill}
                      device={device}
                      isActive={visible && step === "scan"}
                      // @ts-ignore: enable photo capture on Vision Camera
                      photo={true}
                    />
                  ) : (
                    <View style={styles.cameraFallback}>
                      <Text style={{ color: COLORS.WHITE, fontSize: FONT_SIZE.CARD_TEXT, textAlign: 'center' }}>
                        {permissionError || 'Camera not available on this device.'}
                      </Text>
                    </View>
                  )}
                </View>
                <Animated.View
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanAnim }] },
                  ]}
                />
              </View>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanBtn} onPress={handleScanPress}>
                <Text style={styles.scanText}>Scan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {step === "confirm" && (
          <View style={styles.card}>
            {capturedImage && (
              <View style={styles.capturedImageContainer}>
                <Image
                  source={
                    capturedImage?.uri ? { uri: capturedImage.uri } : capturedImage
                  }
                  style={styles.capturedImage}
                  resizeMode="cover"
                  // onError={(error) => console.log("Image error:", error)}
                  // onLoad={() => console.log("Image loaded successfully")}
                />
              </View>
            )}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                setCapturedImage(null);
                setStep("scan");
              }}
            >
              <CrossIcon width={12.43} height={12.43} />
            </TouchableOpacity>
            <Text style={styles.title}>Confirm Scan</Text>
            <Text style={styles.description}>
              Is this the correct scan? Review the image above and confirm to proceed.
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleConfirmNo}
                disabled={isCapturing}
              >
                <Text style={styles.cancelText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scanBtn, isCapturing && styles.disabledBtn]}
                onPress={() => {
                  handleConfirmYes().catch(() => {});
                }}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.scanText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
        {step === "success" && (
          <View style={styles.card}>
            <View style={styles.imageWrapper}>
              <Image
                source={DoneModalIcon}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleBackToTour}>
              <CrossIcon width={12.43} height={12.43} />
            </TouchableOpacity>
            <Text style={styles.title}>Visit Confirmed!</Text>
            <Text style={styles.description}>
              You earned +{successPoints} points for this location! Keep exploring to unlock more rewards and badges.
            </Text>
            <TouchableOpacity style={styles.fullWidthBtn} onPress={handleBackToTour}>
              <Text style={styles.scanText}>Back to Tour</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default ScanVerifyModal;
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    backgroundColor: COLORS.WHITE,
    borderRadius: 32,
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    alignItems: "center",
    position: 'relative',
  },
  imageWrapper: {
    position: "absolute",
    top: -45,
    zIndex: 100,
  },
  image: { width: 90, height: 90 },
  capturedImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: COLORS.SCAN_BORDER,
  },
  capturedImageContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: { position: "absolute", top: 25, right: 25 },
  title: {
    fontSize: 22,
    color: "#101828",
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    textAlign: "center",
  },
  description: {
    marginTop: 12,
    textAlign: "center",
    lineHeight: 24,
    color: "#667085",
    fontSize: 15,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    width: 300,
  },
  scanContainer: {
    marginTop: 30,
    width: 260,
    height: 200,
    position: "relative",
  },
  innerFrame: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(54, 165, 141, 0.05)",
    overflow: "hidden",
    borderRadius: 12,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(54, 165, 141, 0.1)',
  },
  cameraWrapper: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },
  cameraFallback: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  scanLine: {
    width: "100%",
    height: 4,
    backgroundColor: COLORS.SCAN_BORDER,
    shadowColor: COLORS.SCAN_BORDER,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 12,

    elevation: 20,
    borderRadius: 2,
  },
  corner: {
    position: "absolute",
    width: 45,
    height: 45,
    borderColor: COLORS.SCAN_BORDER,
    borderWidth: 6,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 15,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 15,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 15,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 15,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 35,
  },
  cancelBtn: {
    width: "48%",
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    color: "#101828",
    fontFamily: FONT_FAMILY.InterTight_Medium,
  },
  scanBtn: {
    width: "48%",
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.BUTTON_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  scanText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  fullWidthBtn: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.BUTTON_COLOR,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
