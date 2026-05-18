import { PermissionsAndroid, Platform } from "react-native";
import Geolocation from "@react-native-community/geolocation";
import Config from "react-native-config";

export const requestLocationPermission = async (): Promise<boolean> => {
    try {
        if (Platform.OS === "ios") {
            Geolocation.requestAuthorization?.();
            return true;
        }

        const hasPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        if (hasPermission) return true;

        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
                title: "Location Permission",
                message: "App needs access to your location",
                buttonPositive: "OK",
                buttonNegative: "Cancel",
            }
        );

        return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
        console.log("PERMISSION ERROR:", error);
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
            console.log("FALLBACK ERROR:", err);
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
        console.log("REVERSE GEO ERROR:", error);

        const fallback = await getFallbackAddress();
        return fallback || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
};
