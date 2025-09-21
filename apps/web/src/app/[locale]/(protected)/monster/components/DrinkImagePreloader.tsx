"use client";

import { useEffect } from "react";
import { CASES } from "@/app/[locale]/(protected)/monster/cases";

export function DrinkImagePreloader() {
    useEffect(() => {
        Object.values(CASES).forEach((c) => {
            c.variants.forEach((v) => {
                const img = new Image();
                img.src = v.image;
            });
        });
    }, []);

    return null;
}
