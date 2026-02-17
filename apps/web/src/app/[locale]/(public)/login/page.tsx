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
        <div className="mt-12 w-full max-w-md px-4 sm:px-0">
            <div className="bg-surface/90 border-border w-full rounded-2xl border p-5 shadow-lg backdrop-blur-sm sm:p-8">
                <AuthForm />
            </div>
        </div>
    );
}
