export type AuthUser = {
    id: string;
    email: string;
    role: string;
    last_sign_in_at: string | null;
    raw_app_meta_data: {
        role?: string;
        roles?: string[];
        provider?: string;
        providers?: string[];
    };
    raw_user_meta_data: Record<string, unknown>;
};

export type AdminAuthUser = AuthUser & {
    roles?: string[];
    effective_role: string;
};
