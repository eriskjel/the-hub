/**
 * Semantic color utilities – purpose-named tokens (no shade scales).
 * Map to Tailwind theme in globals.css.
 *
 * Usage:
 * - Error (red): `bg-error-subtle`, `text-error`, `border-error-muted`
 * - Status-error (yellow, cached/stale): `bg-status-error-subtle`, `text-status-error`
 * - Success: `bg-success-subtle`, `text-success`
 * - Info: `bg-info-subtle`, `text-info`
 * - Primary: `bg-primary`, `hover:bg-primary-muted`, `text-primary`
 */

export const error = {
    bg: { subtle: "bg-error-subtle" },
    text: { default: "text-error", muted: "text-error-muted" },
    border: { muted: "border-error-muted" },
};

export const statusError = {
    bg: { subtle: "bg-status-error-subtle", default: "bg-status-error" },
    text: { default: "text-status-error" },
    border: { muted: "border-status-error-muted", subtle: "border-status-error-subtle" },
};

export const success = {
    bg: { subtle: "bg-success-subtle", default: "bg-success" },
    text: { default: "text-success" },
    border: { subtle: "border-success-subtle" },
};

export const info = {
    bg: { subtle: "bg-info-subtle", default: "bg-info" },
    text: { default: "text-info" },
    border: { subtle: "border-info-subtle" },
};

export const primary = {
    bg: { default: "bg-primary", muted: "bg-primary-muted", subtle: "bg-primary-subtle" },
    text: { default: "text-primary" },
    hover: { muted: "hover:bg-primary-muted" },
};
