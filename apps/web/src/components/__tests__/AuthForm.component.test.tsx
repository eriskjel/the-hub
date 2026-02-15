import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    getRedirectMock,
    getReplaceMock,
    getRevalidatePathMock,
    setIntl,
    setPathname,
    setSearch,
    supabase,
} from "@/tests/testUtils";
import noMessages from "@/messages/no.json";
import { login, signup } from "@/app/auth/actions/auth";

const replaceMock = getReplaceMock();

// Mock the OAuth starter at top-level so it is hoisted
vi.mock("@/utils/auth/startGithubOAuth", () => ({ startGithubOAuth: vi.fn() }));

vi.mock("@/app/auth/actions/ensureDefaultRole", () => ({
    ensureDefaultRole: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
    vi.clearAllMocks();
    replaceMock.mockReset();
    setIntl({ locale: "no", messages: {} });
    setSearch("");
    setPathname("/");
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    delete (window as Window & { turnstile?: unknown }).turnstile;
});

async function renderAuthForm({ searchParams = "", pathname = "/no/login" } = {}) {
    setIntl({ locale: "no", messages: noMessages });
    setSearch(searchParams);
    setPathname(pathname);

    const { default: AuthForm } = await import("../AuthForm");
    render(<AuthForm />);

    return noMessages.login;
}

describe("<AuthForm />", () => {
    it("renders title, fields, and buttons for login mode", async () => {
        const t = await renderAuthForm();

        // Title
        expect(screen.getByRole("heading", { name: t.title })).toBeInTheDocument();

        // Fields
        const email = screen.getByLabelText(t.email) as HTMLInputElement;
        expect(email.required).toBe(true);
        expect(email.type).toBe("email");

        const pw = screen.getByLabelText(t.password) as HTMLInputElement;
        expect(pw.required).toBe(true);
        expect(pw.type).toBe("password");

        // Single submit
        expect(screen.getByRole("button", { name: t.login })).toBeInTheDocument();
        // Not present in login mode
        expect(screen.queryByRole("button", { name: t.register })).toBeNull();

        // GitHub is present and not a submit
        const github = screen.getByRole("button", { name: t.github }) as HTMLButtonElement;
        expect(github).toBeInTheDocument();
        expect(github.type).toBe("button");

        // Under-text link that switches to signup
        expect(screen.getByText(t.noAccount)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.goToRegister })).toBeInTheDocument();

        // Forgot password prompt under password field
        expect(screen.getByText(t.forgotPasswordInlinePrefix)).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: t.forgotPasswordInlineLink })
        ).toBeInTheDocument();
    });

    it("shows signup fields and submit when mode=signup", async () => {
        const t = await renderAuthForm({
            searchParams: "mode=signup",
        });

        expect(screen.getByRole("heading", { name: t.registerTitle })).toBeInTheDocument();
        expect(screen.getByLabelText(t.name)).toBeInTheDocument();
        expect(screen.getByLabelText(t.confirmPassword)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.register })).toBeInTheDocument();
    });

    it("switches to signup mode when link clicked", async () => {
        const t = await renderAuthForm();

        fireEvent.click(screen.getByRole("button", { name: t.goToRegister }));
        expect(replaceMock).toHaveBeenCalledWith("/no/login?mode=signup");
    });

    it("switches to forgot mode when forgot-password link clicked", async () => {
        const t = await renderAuthForm();

        fireEvent.click(screen.getByRole("button", { name: t.forgotPasswordInlineLink }));
        expect(replaceMock).toHaveBeenCalledWith("/no/login?mode=forgot");
    });

    it("shows forgot-password mode and hides OAuth section", async () => {
        const t = await renderAuthForm({ searchParams: "mode=forgot" });

        expect(screen.getByRole("heading", { name: t.forgotPassword })).toBeInTheDocument();
        expect(screen.getByLabelText(t.email)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.sendResetLink })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: t.github })).toBeNull();
        expect(screen.getByRole("button", { name: t.backToLogin })).toBeInTheDocument();
    });

    it("does not show an error when there is no ?error param", async () => {
        await renderAuthForm();

        // No known error message visible
        expect(screen.queryByText(/Feil brukernavn eller passord/i)).toBeNull();
    });

    it("falls back to generic error on unknown error code", async () => {
        const t = await renderAuthForm({
            searchParams: "error=totally-unknown",
        });

        expect(screen.getByText(t.errors.generic)).toBeInTheDocument();
    });

    it("shows translated error when ?error=invalid-credentials", async () => {
        const t = await renderAuthForm({
            searchParams: "error=invalid-credentials",
        });

        expect(screen.getByText(t.errors.invalidCredentials)).toBeInTheDocument();
    });

    it("shows translated error when ?error=verification-expired", async () => {
        const t = await renderAuthForm({
            searchParams: "error=verification-expired",
        });

        expect(screen.getByText(t.errors.verificationExpired)).toBeInTheDocument();
    });

    it("calls startGithubOAuth('no') when GitHub clicked", async () => {
        const t = await renderAuthForm();

        // Import AFTER mocks so the component uses the mocked function
        const oauth = await import("@/utils/auth/startGithubOAuth");

        fireEvent.click(screen.getByRole("button", { name: t.github }));

        expect(oauth.startGithubOAuth).toHaveBeenCalledWith("no", "/dashboard", "login");
    });

    it("shows translated error when ?error=signup-failed (signup mode)", async () => {
        const t = await renderAuthForm({ searchParams: "mode=signup&error=signup-failed" });
        expect(screen.getByText(t.errors.signupFailed)).toBeInTheDocument();
    });

    it("shows translated error when ?error=confirm-failed (signup mode)", async () => {
        const t = await renderAuthForm({ searchParams: "mode=signup&error=confirm-failed" });
        expect(screen.getByText(t.errors.confirmFailed)).toBeInTheDocument();
    });

    it("uses current-password in login mode", async () => {
        const t = await renderAuthForm({ searchParams: "" });
        const pw = screen.getByLabelText(t.password);
        expect(pw).toHaveAttribute("autocomplete", "current-password");
    });

    it("uses new-password in signup mode", async () => {
        const t = await renderAuthForm({ searchParams: "mode=signup" });
        const pw = screen.getByLabelText(t.password);
        expect(pw).toHaveAttribute("autocomplete", "new-password");
        const confirm = screen.getByLabelText(t.confirmPassword);
        expect(confirm).toHaveAttribute("autocomplete", "new-password");
    });

    it("renders Turnstile and keeps submit disabled before token", async () => {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-sitekey";
        const renderWidget = vi.fn().mockReturnValue("widget-id");
        (window as Window & { turnstile?: unknown }).turnstile = {
            render: renderWidget,
            reset: vi.fn(),
            remove: vi.fn(),
        };

        const t = await renderAuthForm();

        await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
        const submit = screen.getByRole("button", { name: t.login }) as HTMLButtonElement;
        expect(submit.disabled).toBe(true);

        const tokenInput = document.querySelector(
            'input[name="cf-turnstile-response"]'
        ) as HTMLInputElement | null;
        expect(tokenInput).not.toBeNull();
        expect(tokenInput?.value).toBe("");

        const renderCall = renderWidget.mock.calls[0][1] as { action?: string };
        expect(renderCall.action).toBe("login");
    });

    it("enables submit when Turnstile callback returns a token", async () => {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-sitekey";
        const renderWidget = vi.fn().mockImplementation((_container, opts) => {
            (opts as { callback?: (token: string) => void }).callback?.("token-123");
            return "widget-id";
        });
        (window as Window & { turnstile?: unknown }).turnstile = {
            render: renderWidget,
            reset: vi.fn(),
            remove: vi.fn(),
        };

        const t = await renderAuthForm();
        const submit = screen.getByRole("button", { name: t.login }) as HTMLButtonElement;
        await waitFor(() => expect(submit.disabled).toBe(false));
    });
});

describe("signup action", () => {
    type SignUpArgs = {
        email: string;
        password: string;
        options?: { data?: { name?: string; full_name?: string } };
    };

    type RedirectErr = Error & { __isRedirect?: boolean };

    it("passes full name to supabase metadata and redirects to dashboard", async () => {
        supabase().setAuthHandlers({
            signUp: async (args: SignUpArgs) => {
                const { email, password, options } = args;
                expect(email).toBe("alice@example.com");
                expect(password).toBe("secret123");
                // allow extra keys; assert the ones we care about
                expect(options?.data).toEqual(
                    expect.objectContaining({ name: "Alice Example", full_name: "Alice Example" })
                );
                return { data: { user: { id: "u1" } }, error: null };
            },
        });

        const form = new FormData();
        form.set("name", "Alice Example");
        form.set("email", "alice@example.com");
        form.set("password", "secret123");
        form.set("confirmPassword", "secret123");

        // Call and swallow if redirect mock throws
        await signup(form).catch(() => {});

        const redirectMock = getRedirectMock();
        expect(redirectMock).toHaveBeenCalledTimes(1);
        expect(redirectMock.mock.calls[0][0]).toContain("/dashboard");

        const revalidatePath = getRevalidatePathMock();
        expect(revalidatePath).toHaveBeenCalled();
    });

    it("redirects to error on signup failure", async () => {
        supabase().setAuthHandlers({
            signUp: async () => ({ error: { message: "boom" } }),
        });

        const form = new FormData();
        form.set("name", "Bob");
        form.set("email", "bob@example.com");
        form.set("password", "secret123");
        form.set("confirmPassword", "secret123");

        try {
            await signup(form);
            throw new Error("expected redirect");
        } catch (e: unknown) {
            const err = e as RedirectErr;
            expect(err.__isRedirect).toBe(true);
            const href = err.message.replace(/^REDIRECT:/, "");
            const qs = href.split("?")[1] ?? "";
            const params = new URLSearchParams(qs);
            expect(params.get("mode")).toBe("signup");
            expect(params.get("error")).toBe("signup-failed");
        }
    });

    it("requires name and confirmPassword in signup mode", async () => {
        const t = await renderAuthForm({ searchParams: "mode=signup" });
        expect(screen.getByLabelText(t.name)).toBeRequired();
        expect(screen.getByLabelText(t.confirmPassword)).toBeRequired();
    });
});

describe("turnstile verification in auth actions", () => {
    type RedirectErr = Error & { __isRedirect?: boolean };
    const originalEnv = { ...process.env };

    afterEach(() => {
        vi.restoreAllMocks();
        process.env = { ...originalEnv };
    });

    it("maps timeout-or-duplicate to verification-expired", async () => {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "key";
        process.env.TURNSTILE_SECRET_KEY = "secret";
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            )
        );

        const form = new FormData();
        form.set("email", "alice@example.com");
        form.set("password", "secret123");
        form.set("cf-turnstile-response", "dummy");

        try {
            await login(form);
            throw new Error("expected redirect");
        } catch (e: unknown) {
            const err = e as RedirectErr;
            expect(err.__isRedirect).toBe(true);
            expect(err.message).toContain("error=verification-expired");
        }
    });

    it("handles non-200 Siteverify responses and logs error", async () => {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "key";
        process.env.TURNSTILE_SECRET_KEY = "secret";
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response("upstream error", {
                status: 503,
                headers: { "Content-Type": "text/plain" },
            })
        );
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const form = new FormData();
        form.set("email", "alice@example.com");
        form.set("password", "secret123");
        form.set("cf-turnstile-response", "dummy");

        try {
            await login(form);
            throw new Error("expected redirect");
        } catch (e: unknown) {
            const err = e as RedirectErr;
            expect(err.__isRedirect).toBe(true);
            expect(err.message).toContain("error=verification-failed");
        }

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            "Turnstile verification HTTP error",
            expect.objectContaining({ status: 503, expectedAction: "login" })
        );
    });

    it("logs fetch failures and redirects with verification-failed", async () => {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "key";
        process.env.TURNSTILE_SECRET_KEY = "secret";
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const form = new FormData();
        form.set("email", "alice@example.com");
        form.set("password", "secret123");
        form.set("cf-turnstile-response", "dummy");

        try {
            await login(form);
            throw new Error("expected redirect");
        } catch (e: unknown) {
            const err = e as RedirectErr;
            expect(err.__isRedirect).toBe(true);
            expect(err.message).toContain("error=verification-failed");
        }

        expect(errorSpy).toHaveBeenCalledWith(
            "Turnstile token verification failed",
            expect.objectContaining({ expectedAction: "login" })
        );
    });
});
