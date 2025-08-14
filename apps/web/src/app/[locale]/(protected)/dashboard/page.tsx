import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t = await getTranslations("dashboard");
  return (
    <div className="flex h-full items-center justify-center text-center text-white">
      <div>
        <h1 className="mb-4 text-5xl font-bold">The Hub</h1>
        <p className="text-lg">{t("welcome", { name: user?.email ?? "" })}</p>
      </div>
    </div>
  );
}
