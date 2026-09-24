import type { AgreementStatus, AgreementType, RiskLevelType, SectionClauseType } from "@/clause/constants";
import { citeSections, decisionFromJudgment, judgeClauses } from "@/clause/jev.functions";
import { counselAnswer } from "@/clause/voice.functions";

export interface Party {
  name: string;
  role: "LANDLORD" | "TENANT" | "OTHER";
  address?: string;
}

export interface ClauseSection {
  id: string;
  ref: string;
  heading: string;
  type: SectionClauseType;
  content: string;
}

export interface RiskItem {
  id: string;
  level: RiskLevelType;
  clause: string;
  reason: string;
  source?: "jev";
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  queryId?: string;
}

export interface AgreementRecord {
  id: string;
  fileId: string;
  chatId: string;
  title: string;
  type: AgreementType;
  status: AgreementStatus;
  error?: string | null;
  metadata: {
    effectiveDate?: string;
    expiryDate?: string;
    autoRenewal?: boolean;
    governingLaw?: string;
  };
  property: {
    type?: string;
    size?: string;
    usageTerm?: string;
    address?: string;
  } | null;
  payments: {
    rentAmount?: number;
    currency?: string;
    rentCycle?: string;
    depositAmount?: number;
    depositType?: string;
  } | null;
  parties: Party[];
  summary: string[];
  sections: ClauseSection[];
  risks: RiskItem[];
  messages: ChatMessage[];
  sourceText: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileRecord {
  id: string;
  fileName: string;
  mimeType: string;
  status: "PENDING" | "UPLOADED";
  createdAt: string;
}

interface Database {
  files: FileRecord[];
  agreements: AgreementRecord[];
}

const KEY = "clause-db-v1";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function empty(): Database {
  return { files: [], agreements: [] };
}

export function loadDb(): Database {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seeded = seed();
      localStorage.setItem(KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Database;
    if (!parsed.agreements || !parsed.files) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

let writeChain: Promise<unknown> = Promise.resolve();

function withLeaseLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function save(db: Database) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent("clause:db"));
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function seed(): Database {
  const houseFile = uid();
  const officeFile = uid();
  const house = buildHouse(houseFile);
  const office = buildOffice(officeFile);
  return {
    files: [
      {
        id: houseFile,
        fileName: "besant-nagar-house-lease.pdf",
        mimeType: "application/pdf",
        status: "UPLOADED",
        createdAt: house.createdAt,
      },
      {
        id: officeFile,
        fileName: "omr-workloft-office-lease.pdf",
        mimeType: "application/pdf",
        status: "UPLOADED",
        createdAt: office.createdAt,
      },
    ],
    agreements: [house, office],
  };
}

function buildHouse(fileId: string): AgreementRecord {
  const id = uid();
  const chatId = uid();
  const sections: ClauseSection[] = [
    sect("1.1", "Parties", "PARTIES", "This House Rental Agreement is between Meera Krishnan (Landlord), residing at 18, 2nd Seaward Road, Valmiki Nagar, Chennai 600041, and Arjun Raman (Tenant)."),
    sect("2.1", "Premises", "GENERAL", "The Landlord lets to the Tenant the residential flat being Flat 4B, Coral Court, Besant Nagar, Chennai 600090, a 2-bedroom apartment of about 980 square feet, for residential use only."),
    sect("3.1", "Term", "TERM", "The term begins on 1 April 2026 and ends on 31 March 2027, unless ended earlier under this agreement."),
    sect("4.1", "Rent", "RENT_PAYMENT", "Monthly rent is INR 42,000, payable on or before the 5th day of each month by bank transfer. Rent increases by 5 percent if the term is renewed."),
    sect("5.1", "Deposit", "DEPOSIT", "The Tenant has paid a security deposit of INR 2,50,000. INR 25,000 of the deposit is non-refundable as a painting and deep-cleaning charge, deducted even if the flat is returned in the same condition."),
    sect("6.1", "Entry", "RESTRICTIONS", "The Landlord may enter the premises at any time without prior notice to inspect, show the flat, or carry out work the Landlord considers necessary."),
    sect("7.1", "Repairs", "REPAIRS", "The Tenant shall keep the interior in good repair. Structural repairs, including the roof and external plumbing stacks, remain the Landlord's duty unless the damage is caused by the Tenant."),
    sect("8.1", "Utilities", "UTILITIES", "The Tenant pays electricity, gas, and internet. The Landlord pays property tax and the building's common-area water charge."),
    sect("9.1", "Termination", "TERMINATION", "Either party may end the tenancy by giving 60 days' written notice. The Tenant may not terminate during the first 6 months except by paying two months' rent as liquidated damages."),
    sect("10.1", "Renewal", "RENEWAL", "This agreement automatically renews for a further 11 months unless either party gives written notice at least 90 days before expiry."),
    sect("11.1", "Use", "RESTRICTIONS", "No subletting, no commercial use, and no pets without the Landlord's prior written consent, which may be refused at the Landlord's sole discretion."),
    sect("12.1", "Law", "DISPUTE_RESOLUTION", "This agreement is governed by the laws of Tamil Nadu, India. Disputes shall first be discussed in good faith and then referred to the courts at Chennai."),
  ];
  const risks: RiskItem[] = [
    risk(
      "HIGH",
      "The Landlord may enter the premises at any time without prior notice to inspect, show the flat, or carry out work.",
      "A residential tenant is normally entitled to reasonable notice before entry. An anytime, no-notice right is one-sided and hard to live with.",
    ),
    risk(
      "HIGH",
      "INR 25,000 of the deposit is non-refundable as a painting and deep-cleaning charge, deducted even if the flat is returned in the same condition.",
      "A flat deduction that applies even when you leave the home in the same condition functions as a hidden fee, not a true security deposit.",
    ),
    risk(
      "MEDIUM",
      "This agreement automatically renews for a further 11 months unless either party gives written notice at least 90 days before expiry.",
      "Missing a 90-day window locks in another 11 months. Many house leases use 30 days.",
    ),
    risk(
      "MEDIUM",
      "The Tenant may not terminate during the first 6 months except by paying two months' rent as liquidated damages.",
      "Leaving early in the lock-in costs INR 84,000. Confirm you can stay the full six months before signing.",
    ),
    risk(
      "LOW",
      "No pets without the Landlord's prior written consent, which may be refused at the Landlord's sole discretion.",
      "Consent can be refused for any reason. If you have or plan to have a pet, get consent in writing before you sign.",
    ),
  ];
  return {
    id,
    fileId,
    chatId,
    title: "Coral Court Flat 4B — Besant Nagar",
    type: "HOUSE_RENTAL",
    status: "SUCCESS",
    metadata: {
      effectiveDate: "1 April 2026",
      expiryDate: "31 March 2027",
      autoRenewal: true,
      governingLaw: "Tamil Nadu, India",
    },
    property: {
      type: "2-bedroom residential flat",
      size: "980 sq ft",
      usageTerm: "Residential use only",
      address: "Flat 4B, Coral Court, Besant Nagar, Chennai 600090",
    },
    payments: {
      rentAmount: 42000,
      currency: "INR",
      rentCycle: "Monthly, due by the 5th",
      depositAmount: 250000,
      depositType: "SECURITY_DEPOSIT",
    },
    parties: [
      { name: "Meera Krishnan", role: "LANDLORD", address: "18, 2nd Seaward Road, Valmiki Nagar, Chennai" },
      { name: "Arjun Raman", role: "TENANT" },
    ],
    summary: [
      "One-year house lease for a 2BHK in Besant Nagar, starting 1 April 2026.",
      "Rent is INR 42,000 a month, due by the 5th, with a 5 percent increase on renewal.",
      "Security deposit is INR 2,50,000, of which INR 25,000 is non-refundable.",
      "Lock-in is 6 months. After that, either side can leave with 60 days' notice.",
      "The lease renews for 11 months unless notice is given 90 days before expiry.",
      "The landlord may enter without notice. Pets and subletting need written consent.",
      "You pay power, gas, and internet. The landlord pays property tax and common-area water.",
    ],
    sections,
    risks,
    messages: [],
    sourceText: sections.map((s) => s.content).join("\n"),
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  };
}

function buildOffice(fileId: string): AgreementRecord {
  const id = uid();
  const chatId = uid();
  const sections: ClauseSection[] = [
    sect("1", "Parties", "PARTIES", "This Office Rental Agreement is between Harbourline Estates Pvt Ltd (Landlord) and Northwind Studio LLP (Tenant)."),
    sect("2", "Premises", "GENERAL", "Unit 702, Workloft, OMR, Chennai, a furnished office of 1,840 square feet, together with two reserved basement car parks."),
    sect("3", "Term", "TERM", "The term is 3 years commencing 1 June 2026 and expiring 31 May 2029."),
    sect("4", "Rent", "RENT_PAYMENT", "Base rent is INR 1,85,000 per month plus GST, payable in advance on the 1st. Rent escalates by 8 percent at the start of each lease year."),
    sect("5", "Deposit", "DEPOSIT", "Interest-free security deposit equal to 6 months' base rent (INR 11,10,000). The Landlord may deduct unpaid rent, damages, and any amount the Landlord decides is owing, and the Tenant shall top the deposit back up within 7 days."),
    sect("6", "Indemnity", "INDEMNIFICATION", "The Tenant shall indemnify the Landlord against any and all claims, damages, losses, and costs of whatever nature, without limitation, arising out of the Tenant's occupation, even where the Landlord is partly at fault."),
    sect("7", "Repairs and fit-out", "MAINTENANCE", "The Tenant maintains the interior, HVAC filters, and furniture. Structural elements and the building facade remain with the Landlord. Fit-out requires written approval and must be removed at the Tenant's cost at the end of the term unless the Landlord elects to keep it without payment."),
    sect("8", "Termination", "TERMINATION", "The Landlord may terminate for convenience on 30 days' notice. The Tenant may terminate only after month 18, and only by paying the rent for the unexpired portion of the then-current lease year."),
    sect("9", "Renewal", "RENEWAL", "The agreement automatically renews for 3 years unless the Tenant delivers written cancellation notice at least 120 days before expiry."),
    sect("10", "Insurance", "INSURANCE", "The Tenant shall maintain public liability insurance of not less than INR 1 crore and name the Landlord as an additional insured."),
    sect("11", "Law", "DISPUTE_RESOLUTION", "Governed by the laws of India. Exclusive jurisdiction of the courts at Chennai."),
  ];
  const risks: RiskItem[] = [
    risk(
      "CRITICAL",
      "The Tenant shall indemnify the Landlord against any and all claims, damages, losses, and costs of whatever nature, without limitation, arising out of the Tenant's occupation, even where the Landlord is partly at fault.",
      "Unlimited indemnity that survives even when the landlord shares fault can dwarf the rent. This is the clause to negotiate first.",
    ),
    risk(
      "HIGH",
      "The Landlord may terminate for convenience on 30 days' notice. The Tenant may terminate only after month 18, and only by paying the rent for the unexpired portion of the then-current lease year.",
      "The landlord can end the lease easily. You cannot, and an early exit can mean paying the rest of the lease year.",
    ),
    risk(
      "MEDIUM",
      "The agreement automatically renews for 3 years unless the Tenant delivers written cancellation notice at least 120 days before expiry.",
      "A 120-day window on a 3-year rollover is easy to miss. Put the date in a calendar the week you sign.",
    ),
    risk(
      "MEDIUM",
      "The Landlord may deduct unpaid rent, damages, and any amount the Landlord decides is owing, and the Tenant shall top the deposit back up within 7 days.",
      "A six-month deposit plus a 7-day top-up, on amounts the landlord 'decides' are owing, gives them a wide draw on your cash.",
    ),
    risk(
      "LOW",
      "Fit-out must be removed at the Tenant's cost at the end of the term unless the Landlord elects to keep it without payment.",
      "You may pay to install and then pay again to remove it, or leave it behind for free. Budget both outcomes.",
    ),
  ];
  return {
    id,
    fileId,
    chatId,
    title: "Workloft Unit 702 — OMR Office",
    type: "OFFICE_RENTAL",
    status: "SUCCESS",
    metadata: {
      effectiveDate: "1 June 2026",
      expiryDate: "31 May 2029",
      autoRenewal: true,
      governingLaw: "India — courts at Chennai",
    },
    property: {
      type: "Furnished office",
      size: "1,840 sq ft + 2 car parks",
      usageTerm: "Office use",
      address: "Unit 702, Workloft, OMR, Chennai",
    },
    payments: {
      rentAmount: 185000,
      currency: "INR",
      rentCycle: "Monthly in advance, plus GST",
      depositAmount: 1110000,
      depositType: "SECURITY_DEPOSIT",
    },
    parties: [
      { name: "Harbourline Estates Pvt Ltd", role: "LANDLORD" },
      { name: "Northwind Studio LLP", role: "TENANT" },
    ],
    summary: [
      "Three-year office lease at Workloft on OMR, from 1 June 2026.",
      "Base rent is INR 1,85,000 a month plus GST, rising 8 percent each year.",
      "Deposit is six months' rent (INR 11,10,000), interest-free, with a 7-day top-up duty.",
      "Indemnity is unlimited and applies even if the landlord is partly at fault.",
      "The landlord can terminate on 30 days' notice. You cannot leave freely before month 18.",
      "Auto-renews for another 3 years unless you cancel 120 days ahead.",
      "You must carry at least INR 1 crore of public liability insurance.",
    ],
    sections,
    risks,
    messages: [],
    sourceText: sections.map((s) => s.content).join("\n"),
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  };
}

function sect(ref: string, heading: string, type: SectionClauseType, content: string): ClauseSection {
  return { id: uid(), ref, heading, type, content };
}

function risk(level: RiskLevelType, clause: string, reason: string): RiskItem {
  return { id: uid(), level, clause, reason };
}

const STOP = new Set(
  "the a an of to and or for in on at by with from this that your you our is are was be it its as if not no any all can may shall about what when how who whom which into over under than then them they their".split(
    " ",
  ),
);

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9₹]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

const HINGLISH = /\b(kya|kitna|kitne|kab|mera|meri|mujhe|hai|hain|nahi|nahin|batao|bata|samjhao|chahiye|wala|wali|karna|kro|karo|pls|please bata)\b/i;

export function briefFor(agreement: AgreementRecord) {
  const top = agreement.risks[0];
  const rent = agreement.payments?.rentAmount
    ? `${agreement.payments.currency || "INR"} ${agreement.payments.rentAmount.toLocaleString("en-IN")}`
    : "the stated rent";
  const lead = top
    ? `The sharpest issue is ${top.level.toLowerCase()} risk. ${top.reason}`
    : "I did not flag a standout clause.";
  return `${agreement.title}. Rent is ${rent}. ${agreement.summary[0] || ""} ${lead}`.replace(/\s+/g, " ").trim();
}

export function evidencePack(agreement: AgreementRecord) {
  const head = [
    `Title: ${agreement.title}`,
    `Type: ${agreement.type}`,
    `Parties: ${agreement.parties.map((p) => `${p.role} ${p.name}`).join("; ")}`,
    `Property: ${agreement.property?.address || ""} ${agreement.property?.type || ""} ${agreement.property?.size || ""}`,
    `Rent: ${agreement.payments?.currency || ""} ${agreement.payments?.rentAmount || ""} ${agreement.payments?.rentCycle || ""}`,
    `Deposit: ${agreement.payments?.depositAmount || ""} ${agreement.payments?.depositType || ""}`,
    `Dates: ${agreement.metadata.effectiveDate || ""} to ${agreement.metadata.expiryDate || ""}; auto-renew ${agreement.metadata.autoRenewal ? "yes" : "no"}; law ${agreement.metadata.governingLaw || ""}`,
    "Summary:",
    ...agreement.summary.map((s) => `- ${s}`),
    "Sections:",
    ...agreement.sections.map((s) => `${s.ref} ${s.heading}: ${s.content}`),
    "Flagged risks:",
    ...agreement.risks.map((r) => `${r.level}: "${r.clause}" — ${r.reason}`),
  ];
  return head.join("\n");
}

function localAnswer(agreement: AgreementRecord, question: string): { text: string; confident: boolean } {
  const q = question.trim();
  if (/^(hi|hello|hey|thanks|thank you|ok|okay)\b/i.test(q) && q.length < 40) {
    return {
      text: `Hello. I can answer from ${agreement.title} only — rent, deposit, notice, entry, renewal, or the flagged risks.`,
      confident: true,
    };
  }
  if (/\brisks?\b|\bunfair\b|\bred flag\b|\bdangerous\b|\bworried\b/i.test(q)) {
    const lines = agreement.risks.slice(0, 4).map(
      (r) => `- ${r.level}: "${r.clause.slice(0, 180)}" ${r.reason}`,
    );
    return {
      text: lines.length
        ? `Flagged issues in this agreement:\n${lines.join("\n")}`
        : "No risks were flagged on this agreement.",
      confident: true,
    };
  }

  const qTokens = new Set(tokens(q));
  const extra = extraTokens(q);
  for (const t of extra) qTokens.add(t);

  let best: ClauseSection | null = null;
  let bestScore = 0;
  for (const section of agreement.sections) {
    const hay = tokens(`${section.heading} ${section.type} ${section.content}`);
    let score = 0;
    for (const t of hay) if (qTokens.has(t)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = section;
    }
  }

  if (!best || bestScore < 2) {
    return {
      text: "This agreement does not appear to address that directly. Ask about rent, the deposit, notice, renewal, entry, repairs, or the flagged risks.",
      confident: false,
    };
  }

  const related = agreement.risks.find((r) => {
    const overlap = tokens(r.clause).filter((t) => qTokens.has(t) || tokens(best!.content).includes(t));
    return overlap.length >= 2;
  });

  let text = `According to ${best.ref} (${best.heading}): ${best.content}`;
  if (related) text += `\n\nThis was flagged as ${related.level} risk. ${related.reason}`;
  return { text, confident: bestScore >= 2 && !HINGLISH.test(q) };
}

function extraTokens(q: string) {
  const out: string[] = [];
  const add = (words: string[]) => out.push(...words);
  if (/notice|leave|move out|vacate|terminate|lock/i.test(q)) add(["notice", "termination", "renewal", "days"]);
  if (/deposit|refund|security/i.test(q)) add(["deposit", "refundable", "security"]);
  if (/rent|pay|escalat|increase|gst/i.test(q)) add(["rent", "monthly", "escalates"]);
  if (/enter|entry|inspect|privacy|visit/i.test(q)) add(["enter", "notice", "inspect"]);
  if (/renew|auto/i.test(q)) add(["renew", "renewal", "automatically"]);
  if (/repair|maintain|damage|fit/i.test(q)) add(["repair", "maintains", "structural"]);
  if (/pet|sublet|guest/i.test(q)) add(["pets", "subletting", "consent"]);
  if (/insur/i.test(q)) add(["insurance", "liability"]);
  if (/indemn|liabil/i.test(q)) add(["indemnify", "limitation", "losses"]);
  if (/water|electric|utility|tax/i.test(q)) add(["utilities", "electricity", "water"]);
  return out;
}

export async function answerQuestion(agreement: AgreementRecord, question: string) {
  const local = localAnswer(agreement, question);
  let evidence = evidencePack(agreement);
  let text = local.text;
  let confident = local.confident;
  try {
    const cited = await citeSections({
      data: {
        question,
        sections: agreement.sections.slice(0, 10).map((s) => ({
          ref: s.ref,
          heading: s.heading,
          content: s.content,
        })),
      },
    });
    if (cited.ok && cited.ref) {
      const section = agreement.sections.find((s) => s.ref === cited.ref);
      if (section) {
        evidence = `${section.ref} ${section.heading}: ${section.content}`;
        if (!confident) {
          text = `According to ${section.ref} (${section.heading}): ${section.content}`;
          confident = cited.noul >= 0.7;
        }
      }
    }
  } catch {
    /* primary reader stands */
  }
  if (confident && !HINGLISH.test(question)) return text;
  try {
    const remote = await counselAnswer({
      data: { question, evidence, title: agreement.title },
    });
    if (remote.ok) return remote.text;
  } catch {
    /* local fallback */
  }
  return text;
}

const RULES: { test: RegExp; level: RiskLevelType; reason: string }[] = [
  {
    test: /indemnif|hold harmless|any and all claims/i,
    level: "CRITICAL",
    reason: "A broad indemnity can make you pay for losses far beyond the rent, sometimes even when the other side shares fault.",
  },
  {
    test: /without (?:any |prior )?notice/i,
    level: "HIGH",
    reason: "A right to act or enter without notice removes the warning you would normally get.",
  },
  {
    test: /non-?refundable/i,
    level: "HIGH",
    reason: "Money described as non-refundable will not come back, even if you perform.",
  },
  {
    test: /sole discretion/i,
    level: "MEDIUM",
    reason: "Sole discretion means the other party decides, and you have little room to object.",
  },
  {
    test: /automatic(?:ally)? renew/i,
    level: "MEDIUM",
    reason: "Auto-renewal keeps the contract alive unless you cancel inside the stated window.",
  },
  {
    test: /forfeit|waiver of|waives? (?:all|any)/i,
    level: "HIGH",
    reason: "A forfeiture or waiver clause gives up money or rights you might otherwise keep.",
  },
  {
    test: /liquidated damages|unexpired/i,
    level: "MEDIUM",
    reason: "Leaving early can trigger a fixed payment that is larger than ordinary notice.",
  },
];

function classify(text: string): SectionClauseType {
  const rules: [RegExp, SectionClauseType][] = [
    [/indemnif/, "INDEMNIFICATION"],
    [/renew/, "RENEWAL"],
    [/terminat|lock-?in/, "TERMINATION"],
    [/notice/, "NOTICE_PERIOD"],
    [/deposit/, "DEPOSIT"],
    [/rent|gst/, "RENT_PAYMENT"],
    [/repair|fit-?out|maintain/, "MAINTENANCE"],
    [/utilit|electric|water/, "UTILITIES"],
    [/insur/, "INSURANCE"],
    [/enter|sublet|pet|discretion/, "RESTRICTIONS"],
    [/court|jurisdiction|govern/, "DISPUTE_RESOLUTION"],
    [/evict/, "EVICTION"],
    [/landlord|tenant/, "PARTIES"],
    [/term begins|commenc|expir/, "TERM"],
  ];
  const lower = text.toLowerCase();
  for (const [re, type] of rules) if (re.test(lower)) return type;
  return "GENERAL";
}

function money(text: string, label: RegExp): number | undefined {
  const re = new RegExp(
    "(?:" + label.source + ")[^\\d]{0,60}(?:inr|rs\\.?|₹|usd|\\$)?\\s*([\\d,]+)",
    "i",
  );
  const m = text.match(re);
  const raw = m?.[1];
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function sentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);
}

export function analyzeText(fileName: string, text: string): Omit<AgreementRecord, "id" | "fileId" | "chatId" | "messages" | "createdAt" | "updatedAt"> {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  const safeName = String(fileName ?? "agreement.txt");
  const chunks = sentences(clean).slice(0, 24);
  const sections = (chunks.length ? chunks : [clean.slice(0, 1200)]).map((content, i) =>
    sect(`${i + 1}`, headingFor(content), classify(content), content),
  );

  const risks: RiskItem[] = [];
  for (const section of sections) {
    for (const rule of RULES) {
      if (rule.test.test(section.content) && !risks.some((r) => r.clause === section.content)) {
        risks.push(risk(rule.level, section.content.slice(0, 500), rule.reason));
        break;
      }
    }
  }
  const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  risks.sort((a, b) => rank[a.level] - rank[b.level]);

  const lower = clean.toLowerCase();
  let type: AgreementType = "HOUSE_RENTAL";
  if (/office|commercial workspace|cowork/.test(lower)) type = "OFFICE_RENTAL";
  else if (/shop|retail|showroom/.test(lower)) type = "SHOP_RENTAL";
  else if (/short-term|airbnb|month-to-month|guest house/.test(lower)) type = "SHORT_TERM_RENTAL";
  else if (!/rent|lease|tenant|landlord/.test(lower)) type = "OTHERS";

  const rentAmount = money(clean, /monthly rent|base rent|rent is|rent of/);
  const depositAmount = money(clean, /security deposit|deposit of|deposit is/);
  const titleBase = safeName.replace(/\.(pdf|docx|doc|txt|text|md|rtf|csv)$/i, "").replace(/[-_]+/g, " ");
  const title = titleBase.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) || "Uploaded agreement";

  const landlord = nameAfter(clean, /landlord[^A-Za-z]{0,20}([A-Z][A-Za-z .&']{2,50})/);
  const tenant = nameAfter(clean, /tenant[^A-Za-z]{0,20}([A-Z][A-Za-z .&']{2,50})/);

  const summary = [
    `${getTypePhrase(type)} extracted from ${safeName}.`,
    rentAmount ? `Rent figure found: ${rentAmount.toLocaleString("en-IN")}.` : "No clear monthly rent figure was detected.",
    depositAmount ? `Deposit figure found: ${depositAmount.toLocaleString("en-IN")}.` : "No clear deposit figure was detected.",
    ...risks.slice(0, 3).map((r) => `${r.level} risk: ${r.reason}`),
    sections[0] ? `Opening clause: ${sections[0].content.slice(0, 180)}` : "",
  ].filter(Boolean);

  return {
    title,
    type,
    status: clean.length < 80 ? "FAILED" : "SUCCESS",
    error: clean.length < 80 ? "This file has almost no readable text, so the clauses could not be seen. Upload a text-based PDF, Word document, or .txt file." : null,
    metadata: {
      autoRenewal: /automatic(?:ally)? renew/i.test(clean),
      governingLaw: /tamil nadu/i.test(clean) ? "Tamil Nadu, India" : /chennai/i.test(clean) ? "Courts at Chennai" : undefined,
    },
    property: {
      type: type === "OFFICE_RENTAL" ? "Office" : type === "SHOP_RENTAL" ? "Shop" : "Residential",
      address: undefined,
    },
    payments: {
      rentAmount,
      currency: /\$|usd/i.test(clean) ? "USD" : "INR",
      rentCycle: /per month|monthly/i.test(clean) ? "Monthly" : undefined,
      depositAmount,
      depositType: depositAmount ? "SECURITY_DEPOSIT" : undefined,
    },
    parties: [
      landlord ? { name: landlord, role: "LANDLORD" as const } : undefined,
      tenant ? { name: tenant, role: "TENANT" as const } : undefined,
    ].filter(Boolean) as Party[],
    summary: summary.slice(0, 8),
    sections: clean.length < 80 ? [] : sections,
    risks: clean.length < 80 ? [] : risks.slice(0, 8),
    sourceText: clean.slice(0, 20000),
  };
}

async function applyJev<T extends { sections: ClauseSection[]; risks: RiskItem[]; summary?: string[] }>(draft: T): Promise<T> {
  if (!draft.sections.length) return draft;
  let judged: Awaited<ReturnType<typeof judgeClauses>>;
  try {
    judged = await judgeClauses({
      data: {
        sections: draft.sections.slice(0, 8).map((s) => ({ ref: s.ref, content: s.content })),
      },
    });
  } catch {
    return draft;
  }
  if (!judged.ok) return draft;
  const jevRisks: RiskItem[] = [];
  for (const judgment of judged.judgments) {
    const decision = decisionFromJudgment(judgment);
    const section = draft.sections.find((s) => s.ref === judgment.ref);
    if (!section || !decision.level || decision.level === "LOW") continue;
    const clause = section.content.slice(0, 500);
    if (draft.risks.some((r) => r.clause === clause)) continue;
    jevRisks.push({
      id: uid(),
      level: decision.level,
      clause,
      reason: decision.reason,
      source: "jev",
    });
  }
  const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  draft.risks = [...draft.risks.filter((r) => r.source !== "jev"), ...jevRisks]
    .sort((a, b) => rank[a.level] - rank[b.level])
    .slice(0, 8);
  return draft;
}

function headingFor(content: string) {
  const type = classify(content);
  const labels: Record<SectionClauseType, string> = {
    GENERAL: "General",
    PARTIES: "Parties",
    TERM: "Term",
    RENT_PAYMENT: "Rent",
    DEPOSIT: "Deposit",
    MAINTENANCE: "Maintenance",
    REPAIRS: "Repairs",
    TERMINATION: "Termination",
    NOTICE_PERIOD: "Notice",
    RESTRICTIONS: "Restrictions",
    UTILITIES: "Utilities",
    INSURANCE: "Insurance",
    EVICTION: "Eviction",
    DISPUTE_RESOLUTION: "Disputes",
    INDEMNIFICATION: "Indemnity",
    RENEWAL: "Renewal",
  };
  return labels[type];
}

function getTypePhrase(type: AgreementType) {
  if (type === "OFFICE_RENTAL") return "Office lease";
  if (type === "SHOP_RENTAL") return "Shop lease";
  if (type === "SHORT_TERM_RENTAL") return "Short-term rental";
  if (type === "OTHERS") return "Document";
  return "House rental";
}

function nameAfter(text: string, re: RegExp) {
  const m = text.match(re);
  const name = m?.[1];
  if (!name) return undefined;
  return name.replace(/\b(residing|of|and|the)\b.*$/i, "").trim().slice(0, 60);
}

export function listAgreements() {
  return loadDb().agreements.map(toSummary);
}

export function toSummary(a: AgreementRecord) {
  return {
    id: a.id,
    type: a.type,
    title: a.title,
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export function getAgreement(id: string) {
  return loadDb().agreements.find((a) => a.id === id) || null;
}

export async function ask(agreementId: string, message: string) {
  const snapshot = getAgreement(agreementId);
  if (!snapshot) throw new Error("Agreement not found");
  const text = await answerQuestion(snapshot, message);
  return withLeaseLock(() => {
    const db = loadDb();
    const agreement = db.agreements.find((a) => a.id === agreementId);
    if (!agreement) throw new Error("Agreement not found");
    const userMessage: ChatMessage = {
      id: uid(),
      chatId: agreement.chatId,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    const queryId = uid();
    const assistant: ChatMessage = {
      id: uid(),
      chatId: agreement.chatId,
      role: "assistant",
      content: text,
      createdAt: new Date().toISOString(),
      queryId,
    };
    agreement.messages.push(userMessage, assistant);
    agreement.updatedAt = new Date().toISOString();
    save(db);
    return { queryId, userMessage, message: assistant };
  });
}

export function readQuery(queryId: string) {
  const db = loadDb();
  for (const agreement of db.agreements) {
    const message = agreement.messages.find((m) => m.queryId === queryId);
    if (message) return message;
  }
  return null;
}

export function chatPage(chatId: string) {
  const agreement = loadDb().agreements.find((a) => a.chatId === chatId);
  return agreement?.messages ?? [];
}

export function listFiles() {
  return loadDb().files;
}

export async function ingestExtracted(fileName: string, text: string, mimeType = "application/pdf") {
  const analyzed = await applyJev(analyzeText(fileName, text));
  return withLeaseLock(() => {
    const db = loadDb();
    const fileId = uid();
    const now = new Date().toISOString();
    db.files.unshift({
      id: fileId,
      fileName,
      mimeType,
      status: "UPLOADED",
      createdAt: now,
    });
    const agreement: AgreementRecord = {
      ...analyzed,
      id: uid(),
      fileId,
      chatId: uid(),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    db.agreements.unshift(agreement);
    save(db);
    return agreement;
  });
}

export async function reprocess(agreementId: string) {
  const current = getAgreement(agreementId);
  if (!current) return;
  const next = await applyJev(analyzeText(current.title + ".pdf", current.sourceText || ""));
  await withLeaseLock(() => {
    const db = loadDb();
    const agreement = db.agreements.find((a) => a.id === agreementId);
    if (!agreement) return;
    Object.assign(agreement, next, {
      id: agreement.id,
      fileId: agreement.fileId,
      chatId: agreement.chatId,
      messages: agreement.messages,
      createdAt: agreement.createdAt,
      updatedAt: new Date().toISOString(),
    });
    save(db);
  });
}

export function resetWorkspace() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
