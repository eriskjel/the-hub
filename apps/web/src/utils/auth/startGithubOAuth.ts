"use client";

export function startGithubOAuth(locale: string, next = "/dashboard") {
    const localizedNext = next.startsWith(`/${locale}/`) ? next : `/${locale}${next}`;
    window.location.href = `/auth/github?locale=${locale}&next=${encodeURIComponent(localizedNext)}`;
}
