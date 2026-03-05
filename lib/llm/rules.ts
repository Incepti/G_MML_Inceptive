import { MML_ALPHA_AUTHORITY_RULES, STATIC_MML_ADDENDUM, DYNAMIC_MML_ADDENDUM } from "@/lib/mml/alphaAuthority";
import { buildSystemPrompt } from "@/lib/mml/promptBuilder";

export const MML_ALPHA_SYSTEM_RULES = MML_ALPHA_AUTHORITY_RULES;
export { STATIC_MML_ADDENDUM, DYNAMIC_MML_ADDENDUM, buildSystemPrompt };
