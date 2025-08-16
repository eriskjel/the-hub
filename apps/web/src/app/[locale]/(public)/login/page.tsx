import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/");

    return (
        <div className="w-full max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
                <AuthForm />
            </div>
        </div>
    );
}
