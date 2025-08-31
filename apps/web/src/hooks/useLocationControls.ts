import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { GroceryForm } from "@/widgets/grocery-deals/types";
import { geocodeCity, reverseGeocode } from "@/lib/location/api";

const CITY_SEARCH_DEBOUNCE_MS = 350 as const;

export function useLocationControls(form: GroceryForm, t: ReturnType<typeof useTranslations>) {
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
                    }
                } catch {
                    // ignore reverse lookup errors
                }
            },
            () => {
                setLocBusy(false);
                setGeoErr(t("location.locationDenied"));
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
            } catch (err) {
                if ((err as Error).name === "AbortError") return;
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
