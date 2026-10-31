import { z } from "zod";

export const retentionSchema = z.discriminatedUnion("policy", [
    z.object({ policy: z.literal("requester") }),
    z.object({ policy: z.literal("keep") }),
    z.object({ policy: z.literal("remove"), days: z.number().int().min(1).max(365) }),
]);
export type RetentionChoice = z.infer<typeof retentionSchema>;
export type Retention = {
    policy: "requester" | "keep" | "remove";
    days: number | null;
    by: string | null;
    eligible: boolean | null;
};
