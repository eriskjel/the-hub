import { getTranslations } from "next-intl/server";

// if you later need to fetch user info from session you need this:
// export const dynamic = "force-dynamic";

export default async function MonsterPage() {
    const t = await getTranslations("monster");
    return (
        <div className="flex h-full items-center justify-center text-center text-black">
            <div>
                <h1 className="mb-4 text-5xl font-bold">{t("title")}</h1>
            </div>
        </div>
    );
}
