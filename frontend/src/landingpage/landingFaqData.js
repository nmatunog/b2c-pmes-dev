/**
 * Five fixed Q&As for the landing FAQ assistant — aligned with primary by-laws text
 * (`bylaws-text/02.txt` membership fee & minimum shares) and the guided intro in `landing.jsx`.
 * Not a live LLM; answers are curated for accuracy and accessibility.
 */

import { FAQ_CHATBOT_NAME } from "../constants/cooperativeBrand.js";

const N = FAQ_CHATBOT_NAME;

export const LANDING_FAQ_ASSISTANT = {
  en: {
    title: N,
    openLabel: `Open ${N} FAQ`,
    closeLabel: `Close ${N}`,
    placeholder: "Ask about fees, shares, joining…",
    send: "Send",
    welcome: `Hi — I’m ${N}. The chips below give **verified** answers from our intro and by-laws. For anything else, I’ll try a short **AI** reply when your site has it enabled — otherwise I’ll nudge you back to the topics or **By-Laws**.`,
    noMatch:
      "I don’t have a scripted answer for that. Try one of the five topics below, or open **By-Laws** in the footer for the full document.",
    aiDisabled:
      "AI follow-up isn’t enabled on this server (admins can turn it on). Try the five topics or **By-Laws**, or ask something that matches “fee”, “shares”, or “join”.",
    aiError: "I couldn’t reach the AI helper just now. Try again in a moment, or use the quick topics below.",
    apiUnavailable:
      "To use AI follow-up, this app needs **VITE_API_BASE_URL** pointing at the B2C API. You can still use the five quick topics anytime.",
    chipHint: "Common questions",
  },
  ceb: {
    title: N,
    openLabel: `Ablihi ang FAQ ni ${N}`,
    closeLabel: `Sirhi si ${N}`,
    placeholder: "Pangutana bahin sa bayad, shares, pag-apil…",
    send: "Padala",
    welcome: `Kumusta — ako si ${N}. Ang mga chip sa ubos kay **verified** gikan sa intro ug by-laws. Kung laing pangutana, suwayon nako ang **AI** kon naka-on ang site — kung dili, balik sa topics o **By-Laws**.`,
    noMatch:
      "Walay fixed nga tubag ana. Sulayi ang lima ka topic sa ubos, o ablihi ang **By-Laws** sa footer para sa full document.",
    aiDisabled:
      "Wala pa na-enable ang AI dinhi sa server. Sulayi ang lima ka topic o **By-Laws**.",
    aiError: "Naay sayop sa AI karon. Sulayi pag-usab, o gamita ang quick topics sa ubos.",
    apiUnavailable:
      "Aron magamit ang AI, kinahanglan ang **VITE_API_BASE_URL** ngadto sa B2C API. Pwede gihapon ang lima ka topic.",
    chipHint: "Kasagarang pangutana",
  },
};

/** @typedef {{ id: string, keywords: string[], en: { q: string, a: string }, ceb: { q: string, a: string } }} LandingFaqItem */

/** @type {LandingFaqItem[]} */
export const LANDING_FAQ_ITEMS = [
  {
    id: "capital-fee",
    keywords: [
      "fee",
      "500",
      "capital",
      "share",
      "shares",
      "1000",
      "1500",
      "peso",
      "pay",
      "payment",
      "subscription",
      "subscribe",
      "invest",
      "membership fee",
      "annual",
    ],
    en: {
      q: "What is the membership fee and initial share capital?",
      a: "Under the primary by-laws, your membership application must include a **membership fee of ₱500** (refunded if the application is rejected). For regular membership, the by-laws require **subscribing to at least 40 shares** and **paying for at least 10 shares upon approval**. Our guided intro uses **₱100 per share** as a practical example — often **₱1,000** for those first 10 shares — so many members plan around **₱500 fee + ₱1,000 shares (₱1,500)** to start, before building toward the full subscription. Confirm current par value and payment steps with official notices or the full by-laws.",
    },
    ceb: {
      q: "Pila ang membership fee ug initial share capital?",
      a: "Sa primary by-laws, ang application kinahanglan **₱500 nga membership fee** (ibalik kon ma-reject). Para sa regular member, **subscribe ug dili moubos sa 40 ka shares** ug **bayri ang bili sa dili moubos sa 10 ka shares** human ma-approve. Sa among intro, **₱100 kada share** nga pananglitan — kasagaran **₱1,000** sa unang 10 ka shares — busa daghan nagplano ug **₱500 + ₱1,000 (₱1,500)** sa sinugdanan. Palihug kumpirmaha ang par value ug opisyal nga bayad sa among pahibalo o full by-laws.",
    },
  },
  {
    id: "products",
    keywords: [
      "product",
      "products",
      "sell",
      "shop",
      "store",
      "online",
      "buy",
      "detergent",
      "household",
      "personal care",
      "consumable",
      "goods",
      "items",
    ],
    en: {
      q: "What products does B2C offer?",
      a: "B2C is a **consumers cooperative** focused on **consumable products sold online** — for example **detergents**, **household products**, **personal care**, and **similar everyday goods** — so members can **patronize** (use and co-own) the cooperative’s business, consistent with the by-laws’ expectation that members support the co-op’s enterprises.",
    },
    ceb: {
      q: "Unsa among produkto?",
      a: "Ang B2C usa ka **consumers cooperative** nga nagbaligya og **makaon / magamit nga produkto online** — pananglitan **detergent**, **balay**, **personal care**, ug **uban pang konsumable** — aron ang mga miyembro **maka-patronize** sa negosyo sa kooperatiba sumala sa by-laws.",
    },
  },
  {
    id: "what-is-b2c",
    keywords: [
      "what",
      "who",
      "b2c",
      "cooperative",
      "co-op",
      "visayas",
      "digital",
      "owner",
      "ownership",
    ],
    en: {
      q: "What is B2C Consumers Cooperative?",
      a: "We’re a **digital-first consumers cooperative** in the **Visayas**. You’re not just a customer — you’re a **member-owner** with a stake in how we grow. The intro highlights **patronage refunds**, **member value on purchases**, and **dividends on share capital**, within the framework of **Philippine cooperative law (RA 9520)** and our **primary by-laws**.",
    },
    ceb: {
      q: "Unsa ang B2C Consumers Cooperative?",
      a: "Kami usa ka **digital-first consumers cooperative** sa **Visayas**. Dili lang mamalit — **miyembro ug tag-iya** ka. Ang intro naghisgot sa **patronage refunds**, **maayong presyo sa miyembro**, ug **dividends sa share capital**, ubos sa **RA 9520** ug among **primary by-laws**.",
    },
  },
  {
    id: "how-to-join",
    keywords: [
      "join",
      "how",
      "steps",
      "pmes",
      "loi",
      "letter",
      "intent",
      "register",
      "sign up",
      "signup",
      "become",
      "member",
    ],
    en: {
      q: "How do I become a member?",
      a: "The guided path is: **(1)** Complete the **Pre-Membership Education Seminar (PMES)** online and pass the exam; **(2)** Submit your **Letter of Intent (LOI)** through the member portal; **(3)** **Pay share capital and the membership fee** using your **branch’s official payment instructions**. The by-laws also require the board to act on applications within set timelines — details are in the full by-laws.",
    },
    ceb: {
      q: "Unsaon pagka-miyembro?",
      a: "Ang lakang: **(1)** Human ang **PMES** online ug pasa sa exam; **(2)** Padala ang **Letter of Intent (LOI)** sa member portal; **(3)** **Bayri ang share capital ug membership fee** sumala sa **opisyal nga instructions** sa inyong branch. Adunay mga deadline sa board — tan-awa ang full by-laws.",
    },
  },
  {
    id: "rights-duties",
    keywords: [
      "right",
      "rights",
      "duty",
      "duties",
      "responsib",
      "refund",
      "patronage",
      "dividend",
      "vote",
      "assembly",
      "meeting",
      "education",
    ],
    en: {
      q: "What are member benefits and responsibilities?",
      a: "**Benefits** (per orientation and by-laws) include using co-op services, **patronage refunds** tied to your use, fair surplus sharing including **dividends on share capital** where rules allow, and **democratic participation** (e.g. General Assembly). **Responsibilities** include **paying share subscriptions on time**, **patronizing** the cooperative’s business, joining **education programs**, and following **lawful board and assembly decisions** — as spelled out in the membership sections of the primary by-laws.",
    },
    ceb: {
      q: "Unsa ang benepisyo ug responsibilidad sa miyembro?",
      a: "**Benepisyo**: serbisyo sa kooperatiba, **patronage refunds**, **dividends** sa share capital kon gitugotan sa balaud, ug **demokrasya** (e.g. General Assembly). **Responsibilidad**: **bayad sa shares sa panahon**, **patronize** sa negosyo, **education programs**, ug **tumanon ang desisyon** sa board ug assembly — sumala sa membership sections sa primary by-laws.",
    },
  },
];

/**
 * @param {string} query
 * @param {LandingFaqItem[]} items
 * @returns {LandingFaqItem | null}
 */
export function matchLandingFaq(query, items = LANDING_FAQ_ITEMS) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  let best = null;
  let bestScore = 0;
  for (const item of items) {
    let score = 0;
    for (const kw of item.keywords) {
      if (q.includes(kw.toLowerCase())) score += 3;
    }
    const qw = item.en.q.toLowerCase();
    for (const word of qw.split(/\s+/)) {
      if (word.length > 3 && q.includes(word)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 3 ? best : null;
}
