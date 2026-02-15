import ResetPasswordForm from "@/components/ResetPasswordForm";
import { ReactElement } from "react";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage(): ReactElement {
    return (
        <div className="mt-12 w-full max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
                <ResetPasswordForm />
            </div>
        </div>
    );
}
