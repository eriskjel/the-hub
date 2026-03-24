"use client";

import { ReactElement } from "react";
import { FieldText } from "@/components/ui/Fields";
import { useTranslations } from "next-intl";
import { Crosshair, MapPin, X } from "lucide-react";
import { Divider } from "@/components/ui/Divider";
import { useLocationControls } from "@/hooks/useLocationControls";
import { GroceryErrors, GroceryForm } from "./types";
import { fmtCoord } from "@/widgets/grocery-deals/format";

type GroceryDealsSettingsProps = {
    form: GroceryForm;
    initialSettings?: { city?: string; lat?: number; lon?: number };
    isEdit?: boolean;
};

export function GroceryDealsSettings({
    form,
    initialSettings,
    isEdit = false,
}: GroceryDealsSettingsProps): ReactElement {
    const t = useTranslations("widgets.create.groceryDeals");
    const errs: GroceryErrors = form.formState.errors as GroceryErrors;

    const locationControls = useLocationControls(form, t, {
        initial: initialSettings,
    });
    return (
        <div className="space-y-4">
            <FieldText
                label={t("queryLabel")}
                placeholder={t("queryPlaceholder")}
                error={errs.settings?.query?.message}
                {...form.register("settings.query")}
            />

            {isEdit && (
                <FieldText
                    label={t("maxResultsLabel")}
                    placeholder="10"
                    type="number"
                    error={errs.settings?.maxResults?.message}
                    {...form.register("settings.maxResults", { valueAsNumber: true })}
                />
            )}
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
    fromSuggestion,
    onUseMyLocation,
    onResetLocation,
    onCityInputChange,
    errs,
}: ReturnType<typeof useLocationControls> & {
    t: ReturnType<typeof useTranslations>;
    errs: GroceryErrors;
}): ReactElement {
    const cityErr = cityLookupErr ?? errs.settings?.city?.message;
    return (
        <div className="space-y-3">
            <div className="text-sm font-medium">{t("location.sectionTitle")}</div>

            {/* City search — hidden when a suggestion is active */}
            {!fromSuggestion && (
                <div className="space-y-1.5">
                    <input
                        type="text"
                        aria-label={t("location.citySearchLabel")}
                        placeholder={t("location.citySearchPlaceholder")}
                        value={cityInput}
                        onChange={(e) => onCityInputChange(e.target.value)}
                        className={[
                            "border-border bg-surface text-foreground placeholder-muted w-full rounded-xl border px-3 py-2",
                            "focus:border-border-subtle focus:ring-primary/20 outline-none focus:ring-2",
                            cityErr ? "border-error" : "",
                        ].join(" ")}
                    />
                    {cityErr && <p className="text-error text-xs">{cityErr}</p>}
                </div>
            )}

            {cityLookupBusy ? (
                <div className="text-muted flex items-center gap-2 text-xs">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    <span>{t("location.searching")}</span>
                </div>
            ) : fromSuggestion && mode === "city" && hasCoords ? (
                <div className="text-muted flex items-center gap-2 text-xs">
                    <MapPin className="text-success h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="flex-1">
                        {t("location.usingCityLastTime", { city: cityLabel ?? "" })}
                    </span>
                    <button
                        type="button"
                        onClick={onResetLocation}
                        aria-label={t("location.clearSelection")}
                        className="hover:text-foreground cursor-pointer rounded p-0.5 transition-colors"
                    >
                        <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                </div>
            ) : mode === "city" && hasCoords ? (
                <div className="bg-success-subtle text-success ring-success-subtle inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs ring-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    <span>
                        {cityLabel
                            ? t("location.usingCity", { city: cityLabel })
                            : t("location.usingCoords", {
                                  lat: fmtCoord(lat),
                                  lon: fmtCoord(lon),
                              })}
                    </span>
                </div>
            ) : null}

            {!fromSuggestion && <Divider label={t("location.or")} />}

            {/* GPS — hidden while suggestion is active, shows confirmation banner when resolved */}
            {!fromSuggestion && mode === "gps" && hasCoords ? (
                <div
                    role="status"
                    aria-live="polite"
                    className="bg-success flex items-center justify-between rounded-md px-3 py-2 text-sm text-white shadow-sm"
                    title={`${lat}, ${lon}`}
                >
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" aria-hidden />
                        <span>
                            {cityLabel
                                ? t("location.usingCity", { city: cityLabel })
                                : t("location.usingCoords", {
                                      lat: fmtCoord(lat),
                                      lon: fmtCoord(lon),
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
            ) : !fromSuggestion ? (
                <>
                    <button
                        type="button"
                        onClick={onUseMyLocation}
                        className={`flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                            locBusy ? "pointer-events-none opacity-50" : ""
                        } bg-primary hover:bg-primary-muted text-white transition-colors`}
                        aria-busy={locBusy}
                    >
                        <Crosshair className="h-4 w-4" aria-hidden />
                        <span>
                            {locBusy ? t("location.locating") : t("location.useMyLocation")}
                        </span>
                    </button>
                    {geoErr ? <div className="text-error mt-1 text-xs">{geoErr}</div> : null}
                </>
            ) : null}
        </div>
    );
}
