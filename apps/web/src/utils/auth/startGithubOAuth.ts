"use client";

export function startGithubOAuth(locale: string, next = "/dashboard", mode?: "login" | "signup") {
    const localizedNext = next.startsWith(`/${locale}/`) ? next : `/${locale}${next}`;
    const sp = new URLSearchParams({ locale, next: encodeURIComponent(localizedNext) });
    if (mode) sp.set("mode", mode);
    window.location.href = `/auth/github?${sp.toString()}`;
}