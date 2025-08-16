import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { setIntl, setSearch } from "@/tests/testUtils";

// Mock the OAuth starter at top-level so it is hoisted
vi.mock("@/utils/auth/startGithubOAuth", () => ({ startGithubOAuth: vi.fn() }));

afterEach(() => {
    vi.clearAllMocks();
    setIntl({ locale: "no", messages: {} });
    setSearch("");
});

describe("<AuthForm />", () => {
    it("renders title, fields, and all buttons", async () => {
        setIntl({
            locale: "no",
            messages: {
                login: {
                    title: "Logg inn",
                    email: "E-post",
                    password: "Passord",
                    login: "Logg inn",
                    register: "Registrer",
                    github: "GitHub",
                    or: "eller",
                },
            },
        });

        const { default: AuthForm } = await import(".././AuthForm");
        render(<AuthForm />);

        // Title
        expect(screen.getByRole("heading", { name: "Logg inn" })).toBeInTheDocument();

        // Fields (labels + required + types)
        const email = screen.getByLabelText("E-post") as HTMLInputElement;
        expect(email).toBeInTheDocument();
        expect(email.required).toBe(true);
        expect(email.type).toBe("email");

        const pw = screen.getByLabelText("Passord") as HTMLInputElement;
        expect(pw).toBeInTheDocument();
        expect(pw.required).toBe(true);
        expect(pw.type).toBe("password");

        // Buttons
        expect(screen.getByRole("button", { name: "Logg inn" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Registrer" })).toBeInTheDocument();

        const github = screen.getByRole("button", { name: "GitHub" }) as HTMLButtonElement;
        expect(github).toBeInTheDocument();
        expect(github.type).toBe("button"); // important: no accidental form submit
    });

    it("does not show an error when there is no ?error param", async () => {
        setIntl({
            locale: "no",
            messages: {
                login: { title: "Logg inn", github: "GitHub" },
            },
        });

        const { default: AuthForm } = await import(".././AuthForm");
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

        const { default: AuthForm } = await import(".././AuthForm");
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
        const { default: AuthForm } = await import(".././AuthForm");
        render(<AuthForm />);
        expect(screen.getByText("Feil brukernavn eller passord")).toBeInTheDocument();
    });

    it("calls startGithubOAuth('no') when GitHub clicked", async () => {
        setIntl({ locale: "no", messages: { login: { github: "GitHub" } } });

        // Import AFTER mocks so the component uses the mocked function
        const oauth = await import("@/utils/auth/startGithubOAuth");
        const { default: AuthForm } = await import(".././AuthForm");

        render(<AuthForm />);
        fireEvent.click(screen.getByRole("button", { name: "GitHub" }));

        expect(oauth.startGithubOAuth).toHaveBeenCalledWith("no");
    });
});
