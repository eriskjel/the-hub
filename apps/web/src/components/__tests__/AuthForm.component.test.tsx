import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    getReplaceMock,
    getRevalidatePathMock,
    setIntl,
    setPathname,
    setSearch,
    supabase,
} from "@/tests/testUtils";
import noMessages from "@/messages/no.json";
const replaceMock = getReplaceMock();

import { signup } from "@/app/auth/actions/auth";

// Mock the OAuth starter at top-level so it is hoisted
vi.mock("@/utils/auth/startGithubOAuth", () => ({ startGithubOAuth: vi.fn() }));

afterEach(() => {
    vi.clearAllMocks();
    replaceMock.mockReset();
    setIntl({ locale: "no", messages: {} });
    setSearch("");
    setPathname("/");
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

    it("calls startGithubOAuth('no') when GitHub clicked", async () => {
        const t = await renderAuthForm();

        // Import AFTER mocks so the component uses the mocked function
        const oauth = await import("@/utils/auth/startGithubOAuth");

        fireEvent.click(screen.getByRole("button", { name: t.github }));

        expect(oauth.startGithubOAuth).toHaveBeenCalledWith("no");
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
});

describe("signup action", () => {
    type SignUpArgs = {
        email: string;
        password: string;
        options?: { data?: { name?: string } };
    };

    type RedirectErr = Error & { __isRedirect?: boolean };
    it("passes full name to supabase metadata and redirects to dashboard", async () => {
        supabase().setAuthHandlers({
            signUp: async (args: SignUpArgs) => {
                const { email, password, options } = args;
                expect(email).toBe("alice@example.com");
                expect(password).toBe("secret123");
                expect(options?.data).toEqual({ name: "Alice Example" });
                return { data: { user: { id: "u1" } }, error: null };
            },
        });

        const form = new FormData();
        form.set("name", "Alice Example");
        form.set("email", "alice@example.com");
        form.set("password", "secret123");
        form.set("confirmPassword", "secret123");

        try {
            await signup(form);
            throw new Error("expected redirect");
        } catch (e: unknown) {
            const err = e as RedirectErr;
            expect(err.__isRedirect).toBe(true);
            expect(err.message).toContain("/dashboard"); // or "?error=signup-failed"
        }

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
        form.set("password", "x");
        form.set("confirmPassword", "x");

        try {
            await signup(form);
            throw new Error("expected redirect");
        } catch (e: unknown) {
            const err = e as RedirectErr;
            expect(err.__isRedirect).toBe(true);
            expect(err.message).toContain("?error=signup-failed"); // now passes
        }
    });

    it("requires name and confirmPassword in signup mode", async () => {
        const t = await renderAuthForm({ searchParams: "mode=signup" });
        expect(screen.getByLabelText(t.name)).toBeRequired();
        expect(screen.getByLabelText(t.confirmPassword)).toBeRequired();
    });
});
