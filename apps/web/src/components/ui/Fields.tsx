"use client";
import type { InputHTMLAttributes, ReactNode } from "react";

export function FieldRow({ children }: { children: ReactNode }) {
    return <div className="space-y-1.5">{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
    return <label className="block text-sm font-medium">{children}</label>;
}

export function Help({ children }: { children?: ReactNode }) {
    if (!children) return null;
    return <p className="text-xs text-neutral-500">{children}</p>;
}

export function ErrorText({ children }: { children?: ReactNode }) {
    if (!children) return null;
    return <p className="mt-1 text-xs text-red-600">{children}</p>;
}

export function FieldText(
    props: InputHTMLAttributes<HTMLInputElement> & {
        label: string;
        error?: string;
        help?: string;
    }
) {
    const { label, error, help, ...rest } = props;
    return (
        <FieldRow>
            <Label>{label}</Label>
            <input {...rest} className="w-full rounded-xl border border-neutral-300 px-3 py-2" />
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
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: SelectOption[];
    error?: string;
    help?: string;
}) {
    return (
        <FieldRow>
            <Label>{label}</Label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value} disabled={o.disabled}>
                        {o.label}
                    </option>
                ))}
            </select>
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
}: {
    children: ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
    variant?: "solid" | "outline";
    disabled?: boolean;
}) {
    const cls =
        variant === "outline"
            ? "rounded-xl border border-neutral-300 px-3 py-1.5 text-sm"
            : "rounded-xl bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`cursor-pointer ${cls}`}>
            {children}
        </button>
    );
}
