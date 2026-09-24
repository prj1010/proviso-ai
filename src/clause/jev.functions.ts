import { createServerFn } from "@tanstack/react-start";
import { SECTION_CLAUSE_TYPES, type RiskLevelType, type SectionClauseType } from "@/clause/constants";

const MODEL = "jev-latest";
const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

const TRAP_KEYS = ["indemnity", "autorenew", "nonrefund", "lockin"] as const;
type TrapKey = (typeof TRAP_KEYS)[number];

const TRAP_LEVEL: Record<TrapKey, RiskLevelType> = {
  indemnity: "CRITICAL",
  autorenew: "MEDIUM",
  nonrefund: "HIGH",
  lockin: "HIGH",
};

const TRAP_REASON: Record<TrapKey, string> = {
  indemnity: "Broad indemnity. The tenant may pay for losses beyond the rent.",
  autorenew: "Auto-renewal can keep the lease alive unless you cancel in time.",
  nonrefund: "A payment here may not come back even if you perform.",
  lockin: "Leaving early can trigger a one-sided penalty.",
};

const RANK: Record<RiskLevelType, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export interface ClauseJudgment {
  ref: string;
  type: string;
  typeConfidence: number;
  riskScore: number;
  riskConfidence: number;
  traps: Record<TrapKey, number>;
}

function clip(value: unknown, max: number) {
  return String(value ?? "").slice(0, max);
}

function jevKey() {
  return process.env.TYPESAFE_API_KEY?.trim() || "";
}

function worse(current: RiskLevelType | null, next: RiskLevelType): RiskLevelType {
  if (!current) return next;
  return RANK[next] < RANK[current] ? next : current;
}

export function decisionFromJudgment(j: ClauseJudgment): {
  type: SectionClauseType | null;
  level: RiskLevelType | null;
  reason: string;
} {
  let level: RiskLevelType | null = null;
  const reasons: string[] = [];

  for (const key of TRAP_KEYS) {
    const p = j.traps[key] ?? 0;
    if (p >= 0.75) {
      level = worse(level, TRAP_LEVEL[key]);
      reasons.push(TRAP_REASON[key]);
    } else if (p >= 0.45) {
      level = worse(level, "MEDIUM");
      reasons.push(TRAP_REASON[key]);
    }
  }

  if (j.riskConfidence >= 0.45) {
    if (j.riskScore >= 3) level = worse(level, "CRITICAL");
    else if (j.riskScore >= 2) level = worse(level, "HIGH");
    else if (j.riskScore >= 1) level = worse(level, "MEDIUM");
  } else if (j.riskScore >= 2) {
    level = worse(level, "MEDIUM");
    reasons.push("The score leaned severe, but confidence was too low to treat it as critical.");
  }

  if (level && reasons.length === 0) reasons.push("Scored as a tenant risk.");

  const typeOk =
    j.typeConfidence >= 0.45 &&
    (SECTION_CLAUSE_TYPES as readonly string[]).includes(j.type);

  return {
    type: typeOk ? (j.type as SectionClauseType) : null,
    level,
    reason: reasons.join(" "),
  };
}

type RawAnswer = {
  type?: string;
  choice?: string;
  confidence?: number;
  score?: number;
  noul?: number;
};

async function systemOne(
  apiKey: string,
  state: string,
  questions: Record<string, unknown>,
): Promise<Record<string, RawAnswer> | null> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ model: MODEL, state, questions }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { answers?: Record<string, RawAnswer> };
  return body.answers ?? null;
}

const TYPE_CRITERIA: Record<string, string> = {
  GENERAL: "Does not fit a more specific lease topic.",
  PARTIES: "Names the landlord, tenant, or other parties.",
  TERM: "Start date, end date, or length of the lease.",
  RENT_PAYMENT: "How much rent is due, when, or how it increases.",
  DEPOSIT: "Security deposit, advance, or whether money is refundable.",
  MAINTENANCE: "Who maintains the premises.",
  REPAIRS: "Who pays for repairs or damage.",
  TERMINATION: "How the lease ends, lock-in, or early exit.",
  NOTICE_PERIOD: "How much notice is required.",
  RESTRICTIONS: "Rules on entry, pets, guests, or subletting.",
  UTILITIES: "Who pays water, power, or other utilities.",
  INSURANCE: "Required insurance.",
  EVICTION: "Removal of the tenant.",
  DISPUTE_RESOLUTION: "Courts, arbitration, or governing law.",
  INDEMNIFICATION: "One side pays the other's losses.",
  RENEWAL: "Extension or automatic renewal.",
};

function sectionQuestions() {
  return {
    type: {
      type: "choice",
      instructions: "What kind of lease clause is this text?",
      criteria: TYPE_CRITERIA,
    },
    risk: {
      type: "score",
      instructions: "How risky is this clause for the tenant?",
      criteria: [
        "Fine for the tenant",
        "Worth watching",
        "High risk for the tenant",
        "Critical: the tenant can lose far more than the rent",
      ],
    },
    indemnity: {
      type: "noul",
      instructions: "Does this clause impose a broad or unlimited indemnity on the tenant?",
    },
    autorenew: {
      type: "noul",
      instructions: "Does this clause auto-renew or trap the tenant unless they cancel in a short window?",
    },
    nonrefund: {
      type: "noul",
      instructions: "Does this clause make a deposit or fee non-refundable even if the tenant performs?",
    },
    lockin: {
      type: "noul",
      instructions: "Does this clause lock the tenant in with a one-sided penalty for leaving early?",
    },
  };
}

function readJudgment(ref: string, answers: Record<string, RawAnswer>): ClauseJudgment {
  const traps = {} as Record<TrapKey, number>;
  for (const key of TRAP_KEYS) traps[key] = Number(answers[key]?.noul ?? 0);
  return {
    ref,
    type: String(answers.type?.choice ?? "GENERAL"),
    typeConfidence: Number(answers.type?.confidence ?? 0),
    riskScore: Number(answers.risk?.score ?? 0),
    riskConfidence: Number(answers.risk?.confidence ?? 0),
    traps,
  };
}

export const judgeClauses = createServerFn({ method: "POST" })
  .validator((input: { sections?: { ref?: string; content?: string }[] }) => ({
    sections: (input?.sections ?? [])
      .slice(0, 8)
      .map((s) => ({
        ref: clip(s?.ref, 12).trim() || "0",
        content: clip(s?.content, 1400).trim(),
      }))
      .filter((s) => s.content.length > 20),
  }))
  .handler(async ({ data }) => {
    const apiKey = jevKey();
    if (!apiKey) return { ok: false as const, error: "Jev is not configured." };
    if (!data.sections.length) return { ok: false as const, error: "No clauses." };

    const judgments: ClauseJudgment[] = [];
    for (let i = 0; i < data.sections.length; i += 4) {
      const batch = data.sections.slice(i, i + 4);
      const settled = await Promise.all(
        batch.map(async (section) => {
          try {
            const answers = await systemOne(apiKey, section.content, sectionQuestions());
            if (!answers) return null;
            return readJudgment(section.ref, answers);
          } catch {
            return null;
          }
        }),
      );
      for (const row of settled) if (row) judgments.push(row);
    }
    if (!judgments.length) return { ok: false as const, error: "Jev returned nothing." };
    return { ok: true as const, judgments };
  });

export const citeSections = createServerFn({ method: "POST" })
  .validator((input: { question?: string; sections?: { ref?: string; heading?: string; content?: string }[] }) => ({
    question: clip(input?.question, 400).trim(),
    sections: (input?.sections ?? [])
      .slice(0, 10)
      .map((s, i) => ({
        ref: clip(s?.ref, 12).trim() || String(i + 1),
        heading: clip(s?.heading, 80),
        content: clip(s?.content, 500).trim(),
      }))
      .filter((s) => s.content.length > 20),
  }))
  .handler(async ({ data }) => {
    const apiKey = jevKey();
    if (!apiKey || !data.question || !data.sections.length) {
      return { ok: false as const, error: "Citation skipped." };
    }
    const state = data.sections
      .map((s) => `[${s.ref}] ${s.heading}\n${s.content}`)
      .join("\n\n");
    const questions: Record<string, unknown> = {};
    data.sections.forEach((s, i) => {
      questions[`s${i}`] = {
        type: "noul",
        instructions: `Does section [${s.ref}] directly answer this question: ${data.question}`,
      };
    });
    try {
      const answers = await systemOne(apiKey, state, questions);
      if (!answers) return { ok: false as const, error: "Citation failed." };
      let best = { ref: "", noul: 0 };
      data.sections.forEach((s, i) => {
        const noul = Number(answers[`s${i}`]?.noul ?? 0);
        if (noul > best.noul) best = { ref: s.ref, noul };
      });
      if (best.noul < 0.55 || !best.ref) return { ok: true as const, ref: null, noul: best.noul };
      return { ok: true as const, ref: best.ref, noul: best.noul };
    } catch {
      return { ok: false as const, error: "Citation failed." };
    }
  });

export const supportClaim = createServerFn({ method: "POST" })
  .validator((input: { claim?: string; evidence?: string }) => ({
    claim: clip(input?.claim, 900).trim(),
    evidence: clip(input?.evidence, 4000).trim(),
  }))
  .handler(async ({ data }) => {
    const apiKey = jevKey();
    if (!apiKey || !data.claim || !data.evidence) {
      return { ok: false as const, error: "Support check skipped." };
    }
    try {
      const answers = await systemOne(apiKey, data.evidence, {
        supports: {
          type: "noul",
          instructions: `Does the evidence support this statement without adding facts that are not in the evidence? Statement: ${data.claim}`,
        },
      });
      if (!answers) return { ok: false as const, error: "Support check failed." };
      return { ok: true as const, noul: Number(answers.supports?.noul ?? 0) };
    } catch {
      return { ok: false as const, error: "Support check failed." };
    }
  });
