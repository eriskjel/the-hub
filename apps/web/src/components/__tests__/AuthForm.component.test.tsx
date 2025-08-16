import { vi } from "vitest";

// keep a handle so you can assert on it
export const replaceMock = vi.fn();

// wire a mutable search string that your existing setSearch() can control
let __search = "";
globalThis.__setSearch = (q: string) => {
    __search = q;
};

// mock next/navigation hooks used by useAuthMode()
vi.mock("next/navigation", async () => {
    const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
    return {
        ...actual,
        useRouter: () => ({ replace: replaceMock }),
        usePathname: () => "/no/login",
        useSearchParams: () => new URLSearchParams(__search),
    };
});

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { setIntl, setSearch } from "@/tests/testUtils";

// Mock the OAuth starter at top-level so it is hoisted
vi.mock("@/utils/auth/startGithubOAuth", () => ({ startGithubOAuth: vi.fn() }));

afterEach(() => {
    vi.clearAllMocks();
    replaceMock.mockReset();
    setIntl({ locale: "no", messages: {} });
    setSearch("");
});

describe("<AuthForm />", () => {
    it("renders title, fields, and buttons for login mode", async () => {
        setIntl({
            locale: "no",
            messages: {
                login: {
                    title: "Logg inn",
                    email: "E-post",
                    password: "Passord",
                    login: "Logg inn",
                    github: "GitHub",
                    or: "eller",
                    noAccount: "Har du ikke en konto?",
                    goToRegister: "Registrer deg",
                },
            },
        });
        setSearch(""); // default to login mode

        const { default: AuthForm } = await import("../AuthForm");
        render(<AuthForm />);

        // Title
        expect(screen.getByRole("heading", { name: "Logg inn" })).toBeInTheDocument();

        // Fields
        const email = screen.getByLabelText("E-post") as HTMLInputElement;
        expect(email.required).toBe(true);
        expect(email.type).toBe("email");

        const pw = screen.getByLabelText("Passord") as HTMLInputElement;
        expect(pw.required).toBe(true);
        expect(pw.type).toBe("password");

        // Single submit
        expect(screen.getByRole("button", { name: "Logg inn" })).toBeInTheDocument();
        // Not present in login mode
        expect(screen.queryByRole("button", { name: "Registrer" })).toBeNull();

        // GitHub is present and not a submit
        const github = screen.getByRole("button", { name: "GitHub" }) as HTMLButtonElement;
        expect(github).toBeInTheDocument();
        expect(github.type).toBe("button");

        // Under-text link that switches to signup
        expect(screen.getByText("Har du ikke en konto?")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Registrer deg" })).toBeInTheDocument();
    });

    it("shows signup fields and submit when mode=signup", async () => {
        setIntl({
            locale: "no",
            messages: {
                login: {
                    registerTitle: "Opprett konto",
                    name: "Navn",
                    email: "E-post",
                    password: "Passord",
                    confirmPassword: "Bekreft passord",
                    register: "Registrer",
                },
            },
        });
        setSearch("mode=signup");

        const { default: AuthForm } = await import("../AuthForm");
        render(<AuthForm />);

        expect(screen.getByRole("heading", { name: "Opprett konto" })).toBeInTheDocument();
        expect(screen.getByLabelText("Navn")).toBeInTheDocument();
        expect(screen.getByLabelText("Bekreft passord")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Registrer" })).toBeInTheDocument();
    });

    it("switches to signup mode when link clicked", async () => {
        setIntl({
            locale: "no",
            messages: {
                login: { noAccount: "Har du ikke en konto?", goToRegister: "Registrer deg" },
            },
        });
        setSearch("");

        const { default: AuthForm } = await import("../AuthForm");
        render(<AuthForm />);

        fireEvent.click(screen.getByRole("button", { name: "Registrer deg" }));
        expect(replaceMock).toHaveBeenCalledWith("/no/login?mode=signup");
    });

    it("does not show an error when there is no ?error param", async () => {
        setIntl({
            locale: "no",
            messages: {
                login: { title: "Logg inn", github: "GitHub" },
            },
        });

        const { default: AuthForm } = await import("../AuthForm");
        render(<AuthForm />);

        // No known error message visible
        expect(screen.queryByText(/Feil brukernavn eller passord/i)).toBeNull();
    });

    it("falls back to generic error on unknown error code", async () => {
        setIntl({
            locale: "no",
            messages: {
                login: {
                    title: "Logg inn",
                    github: "GitHub",
                    errors: { generic: "Noe gikk galt" },
                },
            },
        });
        setSearch("error=totally-unknown");

        const { default: AuthForm } = await import("../AuthForm");
        render(<AuthForm />);

        expect(screen.getByText("Noe gikk galt")).toBeInTheDocument();
    });

    it("shows translated error when ?error=invalid-credentials", async () => {
        setIntl({
            locale: "no",
            messages: {
                login: { errors: { invalidCredentials: "Feil brukernavn eller passord" } },
            },
        });
        setSearch("error=invalid-credentials");
        const { default: AuthForm } = await import("../AuthForm");
        render(<AuthForm />);
        expect(screen.getByText("Feil brukernavn eller passord")).toBeInTheDocument();
    });

    it("calls startGithubOAuth('no') when GitHub clicked", async () => {
        setIntl({ locale: "no", messages: { login: { github: "GitHub" } } });

        // Import AFTER mocks so the component uses the mocked function
        const oauth = await import("@/utils/auth/startGithubOAuth");
        const { default: AuthForm } = await import("../AuthForm");

        render(<AuthForm />);
        fireEvent.click(screen.getByRole("button", { name: "GitHub" }));

        expect(oauth.startGithubOAuth).toHaveBeenCalledWith("no");
    });
});
