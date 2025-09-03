import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { GroceryForm } from "@/widgets/grocery-deals/types";
import {
    geocodeCity as defGeocodeCity,
    reverseGeocode as defReverseGeocode,
} from "@/lib/location/api";
import { isAbortError } from "@/utils/http";

const CITY_SEARCH_DEBOUNCE_MS = 350 as const;
const GEOLOCATION_TIMEOUT_MS = 10_000 as const;
const GEOLOCATION_MAX_AGE_MS = 60_000 as const;

type LocationServices = {
    geocodeCity: typeof defGeocodeCity;
    reverseGeocode: typeof defReverseGeocode;
};

type UseLocationOptions = {
    services?: LocationServices;
    initial?: { city?: string; lat?: number; lon?: number };
};

export function useLocationControls(
    form: GroceryForm,
    t: ReturnType<typeof useTranslations>,
    options?: UseLocationOptions
) {
    const geocodeCity = options?.services?.geocodeCity ?? defGeocodeCity;
    const reverseGeocode = options?.services?.reverseGeocode ?? defReverseGeocode;

    const [locBusy, setLocBusy] = useState(false);
    const [geoErr, setGeoErr] = useState<string | null>(null);
    const [cityLookupBusy, setCityLookupBusy] = useState(false);
    const [cityLookupErr, setCityLookupErr] = useState<string | null>(null);
    const [cityInput, setCityInput] = useState("");
    const [mode, setMode] = useState<"gps" | "city" | null>(null);

    const debounce = useDebouncedCallback(CITY_SEARCH_DEBOUNCE_MS);
    const activeCityRequest = useRef<AbortController | null>(null);

    // keep latest mode in a ref for async callbacks
    const modeRef = useRef<typeof mode>(mode);
    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    // ensure fields are registered so watch/setValue always behave
    useEffect(() => {
        form.register("settings.lat", { valueAsNumber: true });
        form.register("settings.lon", { valueAsNumber: true });
        form.register("settings.city");
    }, [form]);

    const cityLabel = form.watch("settings.city");
    const lat = form.watch("settings.lat");
    const lon = form.watch("settings.lon");
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

    const bootstrapped = useRef(false);
    useEffect(() => {
        if (bootstrapped.current) return;
        bootstrapped.current = true;

        const seed =
            options?.initial ??
            (form.getValues("settings") as
                | { city?: string; lat?: number; lon?: number }
                | undefined);

        const savedCity = seed?.city?.trim() || "";
        const savedHasCoords =
            typeof seed?.lat === "number" &&
            Number.isFinite(seed.lat) &&
            typeof seed?.lon === "number" &&
            Number.isFinite(seed.lon);

        if (savedCity) setCityInput(savedCity);

        if (savedHasCoords) {
            setMode(savedCity ? "city" : "gps");
            if (!savedCity) {
                setCityLookupBusy(true);
                reverseGeocode(seed!.lat!, seed!.lon!)
                    .then(({ city }) => {
                        if (city) {
                            form.setValue("settings.city", city, {
                                shouldValidate: false,
                                shouldDirty: false,
                            });
                            setCityInput(city);
                        }
                    })
                    .catch(() => {})
                    .finally(() => setCityLookupBusy(false));
            }
        } else if (savedCity) {
            setMode("city");
        } else {
            setMode(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetLocation = () => {
        setMode(null);
        setCityLookupErr(null);
        setGeoErr(null);
        if (activeCityRequest.current) {
            activeCityRequest.current.abort();
            activeCityRequest.current = null;
        }
        setCityLookupBusy(false);
        setCityInput("");
        form.resetField("settings.lat");
        form.resetField("settings.lon");
        form.resetField("settings.city");
    };

    const setCoords = (vlat: number, vlon: number, vcity?: string) => {
        form.setValue("settings.lat", vlat, { shouldValidate: true, shouldDirty: true });
        form.setValue("settings.lon", vlon, { shouldValidate: true, shouldDirty: true });
        if (vcity)
            form.setValue("settings.city", vcity, { shouldValidate: true, shouldDirty: true });
    };

    const onUseMyLocation = () => {
        // cancel in-flight city request
        if (activeCityRequest.current) {
            activeCityRequest.current.abort();
            activeCityRequest.current = null;
        }
        setCityLookupBusy(false);
        setCityLookupErr(null);

        // clear previous city label + search box
        form.resetField("settings.city");
        setCityInput("");

        setGeoErr(null);

        if (!("geolocation" in navigator)) {
            setGeoErr(t("location.notSupported"));
            return;
        }

        setLocBusy(true);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                setLocBusy(false);
                setMode("gps");
                const vlat = pos.coords.latitude;
                const vlon = pos.coords.longitude;
                setCoords(vlat, vlon); // coords first

                // reverse geocode (best-effort), but only apply if still in GPS mode
                try {
                    const { city } = await reverseGeocode(vlat, vlon);
                    if (city && modeRef.current === "gps") {
                        form.setValue("settings.city", city, {
                            shouldValidate: true,
                            shouldDirty: true,
                        });
                        setCityInput(city);
                    }
                } catch {
                    /* ignore */
                }
            },
            () => {
                setLocBusy(false);
                setGeoErr(t("location.locationDenied"));
            },
            {
                enableHighAccuracy: false,
                timeout: GEOLOCATION_TIMEOUT_MS,
                maximumAge: GEOLOCATION_MAX_AGE_MS,
            }
        );
    };

    const onCityInputChange = (value: string) => {
        const q = value.trim();
        setCityInput(value);
        setCityLookupErr(null);

        if (q.length < 2) {
            if (activeCityRequest.current) {
                activeCityRequest.current.abort();
                activeCityRequest.current = null;
            }
            setCityLookupBusy(false);
            return;
        }

        debounce(async () => {
            setCityLookupBusy(true);

            if (activeCityRequest.current) activeCityRequest.current.abort();
            const controller = new AbortController();
            activeCityRequest.current = controller;

            try {
                const {
                    lat: vlat,
                    lon: vlon,
                    displayName,
                } = await geocodeCity(q, controller.signal);
                if (!controller.signal.aborted) {
                    setCoords(vlat, vlon, displayName ?? q);
                    setMode("city");
                    setCityLookupBusy(false);
                }
            } catch (err: unknown) {
                if (isAbortError(err)) return;
                setCityLookupBusy(false);
                setCityLookupErr(t("location.cityLookupFailed"));
            }
        });
    };

    return {
        form,
        mode,
        hasCoords,
        cityLabel,
        lat,
        lon,
        locBusy,
        geoErr,
        cityInput,
        cityLookupBusy,
        cityLookupErr,
        onUseMyLocation,
        onResetLocation: resetLocation,
        onCityInputChange,
    };
}
