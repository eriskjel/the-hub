import { monsterCase } from "./monster";
import { redbullBurnCase } from "@/app/[locale]/(protected)/monster/cases/redbullBurn";

export const CASES = {
    monster: monsterCase,
    redbullBurn: redbullBurnCase,
};

export type CaseKey = keyof typeof CASES;
