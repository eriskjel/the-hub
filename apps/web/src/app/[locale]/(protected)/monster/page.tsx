import { getTranslations } from "next-intl/server";


// hvis du senere skal hente brukerinfo fra session trenger du denne:
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
