"use client";

import {
    Content as SelectContent,
    Icon as SelectIcon,
    Item as SelectItem,
    ItemIndicator as SelectItemIndicator,
    ItemText as SelectItemText,
    Portal,
    Root as SelectRoot,
    Trigger as SelectTrigger,
    Value as SelectValue,
    Viewport as SelectViewport,
} from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { useMemo } from "react";
import type { ReactElement } from "react";
import { cn } from "@/utils/cn";

const EMPTY_SENTINEL = "__none__" as const;

export type SelectOption = { value: string; label: string; disabled?: boolean };

function mapOption(o: SelectOption): SelectOption {
    if (o.value === "") return { ...o, value: EMPTY_SENTINEL };
    return o;
}

function mapValue(v: string): string {
    return v === "" ? EMPTY_SENTINEL : v;
}

function mapValueBack(v: string): string {
    return v === EMPTY_SENTINEL ? "" : v;
}

type SelectProps = {
    value: string;
    onValueChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    "aria-label"?: string;
    id?: string;
    className?: string;
};

export function Select({
    value,
    onValueChange,
    options,
    placeholder,
    disabled,
    "aria-label": ariaLabel,
    id,
    className,
}: SelectProps): ReactElement {
    const mapped = useMemo(() => options.map(mapOption), [options]);
    const innerValue = mapValue(value);
    const handleChange = (v: string) => onValueChange(mapValueBack(v));

    return (
        <SelectRoot value={innerValue} onValueChange={handleChange} disabled={disabled}>
            <SelectTrigger
                id={id}
                aria-label={ariaLabel}
                className={cn(
                    "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left text-foreground outline-none",
                    "transition-colors",
                    "hover:border-border-subtle",
                    "focus:border-border-subtle focus:ring-2 focus:ring-primary/20",
                    "data-[placeholder]:text-muted",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
            >
                <SelectValue placeholder={placeholder} />
                <SelectIcon asChild>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </SelectIcon>
            </SelectTrigger>
            <Portal>
                <SelectContent
                    position="popper"
                    sideOffset={4}
                    className={cn(
                        "relative z-[9999] max-h-[var(--radix-select-content-available-height,280px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-lg"
                    )}
                    style={{
                        width: "var(--radix-select-trigger-width)",
                        maxHeight: "var(--radix-select-content-available-height, 280px)",
                    }}
                >
                    <SelectViewport className="p-1">
                        {mapped.map((opt) => (
                            <SelectItem
                                key={opt.value}
                                value={opt.value}
                                disabled={opt.disabled}
                                textValue={opt.label}
                                className={cn(
                                    "relative flex cursor-default items-center gap-2 rounded-lg py-2 pr-8 pl-3 text-sm outline-none select-none",
                                    "data-[highlighted]:bg-surface-subtle",
                                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                    "data-[state=checked]:bg-primary-subtle data-[state=checked]:text-foreground"
                                )}
                            >
                                <SelectItemText>{opt.label}</SelectItemText>
                                <SelectItemIndicator
                                    className={cn(
                                        "text-primary absolute right-2 flex h-4 w-4 items-center justify-center"
                                    )}
                                >
                                    <Check className="h-4 w-4" aria-hidden />
                                </SelectItemIndicator>
                            </SelectItem>
                        ))}
                    </SelectViewport>
                </SelectContent>
            </Portal>
        </SelectRoot>
    );
}
