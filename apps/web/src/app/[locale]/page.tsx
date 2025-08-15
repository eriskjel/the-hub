import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) redirect(`/${locale}/dashboard`);
    redirect(`/${locale}/login`);
}
