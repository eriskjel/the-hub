"use client";

import { ReactElement, useCallback, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FieldText } from "@/components/ui/Fields";
import { grocerySettingsSchema } from "@/widgets/create/registry";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Divider } from "@/components/ui/Divider";
import { Crosshair, MapPin, X } from "lucide-react";

const CITY_SEARCH_DEBOUNCE_MS = 350;

type GroceryForm = UseFormReturn<{
    title: string;
    kind: "grocery-deals";
    settings: z.infer<typeof grocerySettingsSchema>;
}>;

type GroceryErrors = {
    settings?: {
        query?: { message?: string };
        maxResults?: { message?: string };
        city?: { message?: string };
        lat?: { message?: string };
        lon?: { message?: string };
    };
};

export function GroceryDealsSettings({ form }: { form: GroceryForm }): ReactElement {
    const t = useTranslations("widgets.create.groceryDeals");
    const errs: GroceryErrors = form.formState.errors as GroceryErrors;

    const [locBusy, setLocBusy] = useState(false);
    const [geoErr, setGeoErr] = useState<string | null>(null);
    const [cityLookupBusy, setCityLookupBusy] = useState(false);
    const [cityLookupErr, setCityLookupErr] = useState<string | null>(null);
    const [cityInput, setCityInput] = useState("");
    const [mode, setMode] = useState<"gps" | "city" | null>(null);

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

    const setCoords = (lat: number, lon: number, city?: string) => {
        form.setValue("settings.lat", lat, { shouldValidate: true });
        form.setValue("settings.lon", lon, { shouldValidate: true });
        if (city) form.setValue("settings.city", city, { shouldValidate: true });
    };

    const handleUseMyLocation = () => {
        // cancel any in-flight city request
        if (activeCityRequest.current) {
            activeCityRequest.current.abort();
            activeCityRequest.current = null;
        }

        setCityLookupBusy(false);
        setCityLookupErr(null);

        // clear previous city label + search box
        form.setValue("settings.city", undefined as unknown as string, { shouldValidate: true });
        setCityInput("");

        setGeoErr(null);
        setLocBusy(true);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                setLocBusy(false);
                setMode("gps");
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                setCoords(lat, lon); // coords first

                // optional: fetch a nice label
                try {
                    const r = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}&zoom=10`);
                    if (r.ok) {
                        const { city: label, displayName } = await r.json();
                        if (label || displayName) {
                            form.setValue("settings.city", label ?? displayName, {
                                shouldValidate: true,
                            });
                        }
                    }
                } catch {
                    // ignore reverse lookup errors; coords are enough
                }
            }
            // …
        );
    };

    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeCityRequest = useRef<AbortController | null>(null);

    const debounce = useCallback((fn: () => void, ms: number) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(fn, ms);
    }, []);

    const handleCityChange = (value: string) => {
        const q = value.trim();
        setCityLookupErr(null);

        // If input too short: cancel pending work and clear busy
        if (q.length < 2) {
            if (activeCityRequest.current) {
                activeCityRequest.current.abort();
                activeCityRequest.current = null;
            }
            setCityLookupBusy(false);
            return;
        }

        debounce(async () => {
            // mark busy only when a request will actually start
            setCityLookupBusy(true);

            // cancel any in-flight request
            if (activeCityRequest.current) activeCityRequest.current.abort();
            const controller = new AbortController();
            activeCityRequest.current = controller;

            try {
                const res = await fetch(`/api/geocode?city=${encodeURIComponent(q)}`, {
                    signal: controller.signal,
                });
                if (!res.ok) {
                    setCityLookupBusy(false);
                    setCityLookupErr(
                        res.status === 404
                            ? t("location.cityNotFound")
                            : t("location.cityLookupFailed")
                    );
                    return;
                }
                const { lat, lon, displayName } = await res.json();
                // only apply if not aborted
                if (!controller.signal.aborted) {
                    setCoords(lat, lon, displayName ?? q);
                    setMode("city");
                    setCityLookupBusy(false);
                }
            } catch (err) {
                if ((err as any)?.name === "AbortError") return; // ignore
                setCityLookupBusy(false);
                setCityLookupErr(t("location.cityLookupFailed"));
            }
        }, CITY_SEARCH_DEBOUNCE_MS);
    };

    // Live label
    const city = form.watch("settings.city");
    const lat = form.watch("settings.lat");
    const lon = form.watch("settings.lon");
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

    return (
        <div className="space-y-4">
            <FieldText
                label={t("queryLabel")}
                placeholder={t("queryPlaceholder")}
                error={errs.settings?.query?.message}
                {...form.register("settings.query")}
            />

            <FieldText
                label={t("maxResultsLabel")}
                placeholder="10"
                type="number"
                error={errs.settings?.maxResults?.message}
                {...form.register("settings.maxResults", { valueAsNumber: true })}
            />

            {/* Location section */}
            <div className="space-y-3">
                <div className="text-sm font-medium opacity-80">{t("location.sectionTitle")}</div>

                {/* GPS action OR GPS confirmation */}
                {mode === "gps" && hasCoords ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center justify-between rounded-md bg-emerald-600 px-3 py-2 text-sm text-white shadow-sm"
                        title={`${lat}, ${lon}`}
                    >
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" aria-hidden />
                            <span>
                                {city
                                    ? t("location.usingCity", { city })
                                    : t("location.usingCoords", {
                                          lat: (lat as number).toFixed(4),
                                          lon: (lon as number).toFixed(4),
                                      })}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={resetLocation}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs/5 ring-1 ring-white/40 hover:bg-white/10"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden />
                            <span>{t("location.clearSelection")}</span>
                        </button>
                    </div>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={handleUseMyLocation}
                            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                                locBusy ? "pointer-events-none opacity-50" : ""
                            } bg-blue-600 text-white transition-colors hover:bg-blue-500`}
                            aria-busy={locBusy}
                        >
                            <Crosshair className="h-4 w-4" aria-hidden />
                            <span>
                                {locBusy ? t("location.locating") : t("location.useMyLocation")}
                            </span>
                        </button>

                        {/* show geo error under the action */}
                        {geoErr ? <div className="mt-1 text-xs text-red-400">{geoErr}</div> : null}
                    </>
                )}

                <Divider label={t("location.or")} />

                <FieldText
                    label={t("location.citySearchLabel")}
                    placeholder={t("location.citySearchPlaceholder")}
                    value={cityInput}
                    onChange={(e) => {
                        const v = e.target.value;
                        setCityInput(v);
                        handleCityChange(v);
                    }}
                    error={cityLookupErr ?? errs.settings?.city?.message}
                />

                {/* Visible feedback under city field */}
                {cityLookupBusy ? (
                    <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        <span>{t("location.searching")}</span>
                    </div>
                ) : mode === "city" && hasCoords ? (
                    <div className="mt-1 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 ring-1 ring-emerald-200">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        <span>
                            {city
                                ? t("location.usingCity", { city })
                                : t("location.usingCoords", {
                                      lat: (lat as number).toFixed(4),
                                      lon: (lon as number).toFixed(4),
                                  })}
                        </span>
                    </div>
                ) : null}
            </div>

            {/* Hidden fields bound to form */}
            <input type="hidden" {...form.register("settings.lat", { valueAsNumber: true })} />
            <input type="hidden" {...form.register("settings.lon", { valueAsNumber: true })} />
            <input type="hidden" {...form.register("settings.city")} />
        </div>
    );
}
