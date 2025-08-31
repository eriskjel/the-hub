"use client";

import { ReactElement } from "react";
import { FieldText } from "@/components/ui/Fields";
import { useTranslations } from "next-intl";
import { Divider } from "@/components/ui/Divider";
import { Crosshair, MapPin, X } from "lucide-react";
import { useLocationControls } from "@/hooks/useLocationControls";
import { GroceryErrors, GroceryForm } from "./types";

export function GroceryDealsSettings({ form }: { form: GroceryForm }): ReactElement {
    const t = useTranslations("widgets.create.groceryDeals");
    const errs: GroceryErrors = form.formState.errors as GroceryErrors;

    const locationControls = useLocationControls(form, t);

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

            <LocationSection t={t} {...locationControls} errs={errs} />
        </div>
    );
}

function LocationSection({
    t,
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
    onResetLocation,
    onCityInputChange,
    errs,
}: ReturnType<typeof useLocationControls> & {
    t: ReturnType<typeof useTranslations>;
    errs: GroceryErrors;
}): ReactElement {
    return (
        <div className="space-y-3">
            <div className="text-sm font-medium opacity-80">{t("location.sectionTitle")}</div>

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
                            {cityLabel
                                ? t("location.usingCity", { city: cityLabel })
                                : t("location.usingCoords", {
                                      lat: (lat as number).toFixed(4),
                                      lon: (lon as number).toFixed(4),
                                  })}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onResetLocation}
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
                        onClick={onUseMyLocation}
                        className={`flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                            locBusy ? "pointer-events-none opacity-50" : ""
                        } bg-blue-600 text-white transition-colors hover:bg-blue-500`}
                        aria-busy={locBusy}
                    >
                        <Crosshair className="h-4 w-4" aria-hidden />
                        <span>
                            {locBusy ? t("location.locating") : t("location.useMyLocation")}
                        </span>
                    </button>
                    {geoErr ? <div className="mt-1 text-xs text-red-400">{geoErr}</div> : null}
                </>
            )}

            <Divider label={t("location.or")} />

            <FieldText
                label={t("location.citySearchLabel")}
                placeholder={t("location.citySearchPlaceholder")}
                value={cityInput}
                onChange={(e) => onCityInputChange(e.target.value)}
                error={cityLookupErr ?? errs.settings?.city?.message}
            />

            {cityLookupBusy ? (
                <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    <span>{t("location.searching")}</span>
                </div>
            ) : mode === "city" && hasCoords ? (
                <div className="mt-1 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 ring-1 ring-emerald-200">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    <span>
                        {cityLabel
                            ? t("location.usingCity", { city: cityLabel })
                            : t("location.usingCoords", {
                                  lat: (lat as number).toFixed(4),
                                  lon: (lon as number).toFixed(4),
                              })}
                    </span>
                </div>
            ) : null}
        </div>
    );
}
