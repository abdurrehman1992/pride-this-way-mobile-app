import { PermissionsAndroid, Platform } from "react-native";
import Geolocation from "@react-native-community/geolocation";
import Config from "react-native-config";

export const requestLocationPermission = async (requestBackground = false): Promise<boolean> => {
    try {
        if (Platform.OS === "ios") {
            const authorization = await new Promise<boolean>((resolve) => {
                Geolocation.requestAuthorization(
                    () => resolve(true),
                    () => resolve(false),
                );
            });
            return authorization;
        }

        const hasPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        if (!hasPermission) {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: "Location Permission",
                    message: "App needs access to your location",
                    buttonPositive: "OK",
                    buttonNegative: "Cancel",
                }
            );

            if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
        }

        // Android 10+ may offer a separate "Allow all the time" setting.
        // Request it when a tour is actually running, but do not make
        // background permission failure block normal foreground navigation.
        if (requestBackground && Number(Platform.Version) >= 29) {
            try {
                await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
                    {
                        title: "Background Location Permission",
                        message: "Allow location while the tour is running so routes continue when the screen is locked.",
                        buttonPositive: "Allow",
                        buttonNegative: "Not now",
                    }
                );
            } catch {
                // Foreground location remains sufficient while the app is open.
            }
        }

        // Android 13+ requires notification permission for the ongoing
        // foreground-tour disclosure to appear normally in the notification
        // shade. A denial does not block foreground navigation.
        if (requestBackground && Number(Platform.Version) >= 33) {
            try {
                const notificationPermission =
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
                const hasNotificationPermission = await PermissionsAndroid.check(
                    notificationPermission
                );
                if (!hasNotificationPermission) {
                    await PermissionsAndroid.request(notificationPermission, {
                        title: "Active Tour Notification",
                        message: "Show an ongoing notification while your tour uses location for routing.",
                        buttonPositive: "Allow",
                        buttonNegative: "Not now",
                    });
                }
            } catch {
                // The location foreground service can still run without this
                // optional notification-shade permission.
            }
        }

        return true;
    } catch (error) {
        // console.log("PERMISSION ERROR:", error);
        return false;
    }
};

export const getCurrentPosition = (options: any) => {
    return new Promise<any>((resolve, reject) => {
        Geolocation.getCurrentPosition(resolve, reject, options);
    });
};

export const getAddressFromCoords = async (
    lat: number,
    lon: number
): Promise<string> => {
    const formatAddress = (addr: any) => {
        if (!addr) return "";

        const parts = [
            addr.house_number,
            addr.road,
            addr.neighbourhood,
            addr.suburb,
            addr.city || addr.town || addr.village || addr.county,
            addr.state || addr.state_district,
            addr.country,
        ].filter(Boolean);

        return parts.join(", ");
    };

    const getFallbackAddress = async () => {
        try {
            if (Config.MAPBOX_TOKEN) {
                const mapboxUrl = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lon}&latitude=${lat}&access_token=${Config.MAPBOX_TOKEN}&language=en&limit=1`;
                const mapboxResponse = await fetch(mapboxUrl);
                if (mapboxResponse.ok) {
                    const mapboxData = await mapboxResponse.json();
                    const feature = mapboxData?.features?.[0];
                    const context = feature?.properties?.context || {};
                    const street = [
                        feature?.properties?.address,
                        feature?.properties?.street,
                    ]
                        .filter(Boolean)
                        .join(" ");
                    const parts = [
                        street || feature?.properties?.name,
                        context?.place?.name,
                        context?.region?.name,
                        context?.country?.name,
                    ].filter(Boolean);

                    if (parts.length) {
                        return parts.join(", ");
                    }
                }
            }

            const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;

            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();

            const parts = [
                data.city || data.locality || data.principalSubdivision,
                data.principalSubdivision,
                data.countryName,
            ].filter(Boolean);

            if (parts.length) return parts.join(", ");

            return null;
        } catch (err) {
            // console.log("FALLBACK ERROR:", err);
            return null;
        }
    };

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=en`;

        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "LocationApp/1.0",
            },
        });

        if (!response.ok) throw new Error("Reverse geocode failed");

        const data = await response.json();

        if (data?.display_name) return data.display_name;

        const formatted = formatAddress(data?.address);
        if (formatted) return formatted;

        const fallback = await getFallbackAddress();

        return fallback || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch (error) {
        // console.log("REVERSE GEO ERROR:", error);

        const fallback = await getFallbackAddress();
        return fallback || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
};
