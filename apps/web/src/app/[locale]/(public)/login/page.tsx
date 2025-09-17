import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) redirect(`/${locale}/dashboard`);

    return (
        <div className="mt-12 w-full max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
                <AuthForm />
            </div>
        </div>
    );
}
