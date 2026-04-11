import { DrinkStrip, DrinkStripProps } from "./DrinkStrip";
import { ReactElement } from "react";

export function Roller(props: DrinkStripProps): ReactElement {
    return (
        <div className="border-border relative mx-auto flex h-auto w-full max-w-[640px] overflow-hidden rounded-xl border-2 bg-black/80 py-2">
            <div className="absolute top-0 left-1/2 z-10 h-full w-0.5 -translate-x-1/2 bg-red-500" />
            <DrinkStrip {...props} />
        </div>
    );
}
