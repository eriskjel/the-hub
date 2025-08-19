import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type NextCookieOptions = NonNullable<Parameters<NextResponse["cookies"]["set"]>[2]>;

export async function updateSession(request: NextRequest, response: NextResponse) {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: Array<{ name: string; value: string; options?: NextCookieOptions }>) {
                    // update the request (visible to later middleware in the chain)
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });
                    // update the response (sent to the browser)
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    await supabase.auth.getUser();
    return response;
}