"use client";

import type { InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { Select } from "@/components/ui/Select";

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

export function FieldRow({ children }: { children: ReactNode }): ReactElement {
    return <div className="space-y-1.5">{children}</div>;
}

export function Label({ children }: { children: ReactNode }): ReactElement {
    return <label className="block text-sm font-medium">{children}</label>;
}

export function Help({ children }: { children?: ReactNode }): ReactElement | null {
    if (!children) return null;
    return <p className="text-xs text-neutral-500">{children}</p>;
}

export function ErrorText({ children }: { children?: ReactNode }): ReactElement | null {
    if (!children) return null;
    return <p className="mt-1 text-xs text-red-600">{children}</p>;
}

export function FieldText(
    props: InputHTMLAttributes<HTMLInputElement> & {
        label: string;
        error?: string;
        help?: string;
        inputClassName?: string;
    }
): ReactElement {
    const { label, error, help, inputClassName, className, ...rest } = props;
    return (
        <FieldRow>
            <Label>{label}</Label>
            <input
                {...rest}
                className={cx(
                    "w-full rounded-xl border border-neutral-300 bg-white",
                    "px-3 py-2 text-neutral-900 placeholder-neutral-500",
                    "outline-none focus:border-neutral-400 focus:ring-2 focus:ring-black/20",
                    inputClassName,
                    className
                )}
            />
            <ErrorText>{error}</ErrorText>
            <Help>{help}</Help>
        </FieldRow>
    );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };

export function FieldSelect({
    label,
    value,
    onChange,
    options,
    error,
    help,
    selectClassName,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: SelectOption[];
    error?: string;
    help?: string;
    selectClassName?: string;
}): ReactElement {
    return (
        <FieldRow>
            <Label>{label}</Label>
            <Select
                value={value}
                onValueChange={onChange}
                options={options}
                className={cx("w-full", selectClassName)}
            />
            <ErrorText>{error}</ErrorText>
            <Help>{help}</Help>
        </FieldRow>
    );
}

export function Button({
    children,
    onClick,
    type = "button",
    variant = "solid",
    disabled,
    className,
}: {
    children: ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
    variant?: "solid" | "outline";
    disabled?: boolean;
    className?: string;
}): ReactElement {
    const base = "rounded-xl px-3 py-1.5 text-sm cursor-pointer disabled:opacity-50";
    const styles =
        variant === "outline"
            ? "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
            : "bg-black text-white hover:bg-black/90";
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={cx(base, styles, className)}
        >
            {children}
        </button>
    );
}
