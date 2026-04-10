import {
  Award,
  BookOpen,
  History,
  Landmark,
  Scale,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

/**
 * PMES modules — synthesized from two sources (keep in sync when editing):
 * (1) B2C expanded seminar / Ka-uban VO: history, CODEACE, ecosystem, Philippine law depth.
 * (2) Facilitator slide deck: opening, COOPS, flow, member role
 *     (responsibilities / rights / balance), reflection, closing — tone: friendly-professional,
 *     “not just customers—you are owners,” “no contribution, no cooperative.”
 * Scripts favor natural Ka-uban delivery; outlines are scannable bullets for the UI.
 */
export const modules = [
  {
    id: "welcome",
    title: "Module 1: Welcome & opening",
    icon: Users,
    items: [
      {
        t: "Welcome to PMES",
        outline:
          "• B2C Consumers Cooperative — Pre-Membership Education Seminar\n• Today: what a cooperative is, how it works, and your role as a member\n• More than facts — preparing you to be a responsible, active member\n• Your guide: Ka-uban (partner on this journey)",
        script:
          "Welcome to the Pre-Membership Education Seminar of B2C Consumers Cooperative. I am Ka-uban — in our language, partner — and I will walk with you today. We will help you understand what a cooperative is, how it works, and your role as a member. This session is not only about learning; it is about preparing you to become a responsible and active member-owner. Let us set a tone that is friendly and professional, and build trust from the start.",
      },
      {
        t: "Why are you here?",
        outline:
          "• Compliance before membership\n• Honest answers about cooperatives and B2C\n• Invitation from a sponsor, or curiosity — savings, loans, community\n• Whatever your reason: practical insight so you can decide with confidence",
        script:
          "Why are you here today? Some of you need this seminar for membership requirements. Others want clear information about cooperatives. Maybe a friend invited you, or you are exploring savings, credit, patronage, or serving the community. Whatever brought you, we want you to leave with practical understanding — so you can decide with confidence. When you are ready, continue to what a cooperative really is.",
      },
    ],
  },
  {
    id: "basics",
    title: "Module 2: Understanding cooperatives",
    icon: BookOpen,
    items: [
      {
        t: "What is a cooperative?",
        outline:
          "• People with a common goal who pool resources to build a business that serves their needs\n• Not only a business — also a social organization\n• Serves members and community, not a single outside owner",
        script:
          "What is a cooperative? It is a group of people with a common goal who pool resources together to build a business that serves their needs. Remember: it is not only a business. It is also a social organization — people before pure profit for outsiders. In B2C we protect that spirit every day.",
      },
      {
        t: "Nature of co-ops — COOPS",
        outline:
          "• Capitalized by members\n• Owned by members\n• Operated by elected officers under democratic control\n• Patronized by members — use what you own\n• Service-oriented — welfare over exploitation\n• Key line: You are not just customers — you are owners.",
        script:
          "Remember the word COOPS. Capitalized by members. Owned by members. Operated by leaders you elect, under democratic rules. Patronized by members — you use the services you collectively own. And service-oriented — success is measured in member and community welfare. Here is the line to carry in your pocket: you are not just customers — you are owners. Say it with me: COOPS.",
      },
      {
        t: "Why cooperatives exist",
        outline:
          "• Help people become self-reliant\n• Access affordable services — e.g. fair savings and credit\n• Improve quality of life in the community\n• Facilitator tip: simple example — borrowing without abusive interest where policies allow",
        script:
          "Cooperatives exist to help people become self-reliant, access affordable services, and improve their quality of life. Think of a plain example: when members need a loan for school, health, or a small business, the cooperative can offer terms that reflect mutual help rather than predatory profit — always according to policies and the law. That is the difference mutual effort can make.",
      },
    ],
  },
  {
    id: "history",
    title: "Module 3: History & milestones",
    icon: History,
    items: [
      {
        t: "Philippine roots",
        outline:
          "• 1896: Dr. Jose Rizal — Agricultural Marketing Cooperative in Dapitan\n• Early 1900s: Government programs (e.g. rural credit initiatives)\n• 1907: Rural Credit Bill; 1940: General Basic Cooperative Law — foundations for a national movement",
        script:
          "History reminds us that our national hero, Dr. Jose Rizal, organized an agricultural marketing cooperative while in exile in Dapitan in eighteen ninety-six. Later, government-backed programs began — for example rural credit in the early nineteen hundreds — and laws like the Rural Credit Bill in nineteen oh seven and the General Basic Cooperative Law in nineteen forty helped shape today’s movement. Our roots are deep and Filipino.",
      },
      {
        t: "Key milestones (1970s–1980s)",
        outline:
          "• April 14, 1973: PD 175 — strengthening the cooperative movement\n• August 1973: PD 269 — electric cooperatives\n• August 24, 1975: PD 775 — sugar planters and producers’ cooperatives",
        script:
          "Fast forward to the nineteen seventies. Presidential Decree one seventy-five in April nineteen seventy-three aimed to strengthen cooperatives. PD two sixty-nine created electric cooperatives. PD seven seventy-five supported sugar planters and producers. Each step widened what cooperatives could do for ordinary people.",
      },
      {
        t: "Republic Act 6938 & the CDA",
        outline:
          "• March 10, 1990: RA 6938 — Cooperative Development Authority (CDA) created\n• National supervision and development of cooperatives\n• Registration, regulation, and support within the law",
        script:
          "On March tenth, nineteen ninety, Republic Act sixty-nine thirty-eight created the Cooperative Development Authority — the CDA. That gave the country a dedicated body to register, supervise, and promote cooperatives in line with national policy. For members, it means clearer standards and a partner agency for lawful growth.",
      },
      {
        t: "Republic Act 9520",
        outline:
          "• Amended the Cooperative Code — signed February 17, 2009 (effect 2008 reform)\n• Updates types of co-ops, governance, and compliance\n• Known as the Philippine Cooperative Code of 2008",
        script:
          "Republic Act ninety-five twenty updated the cooperative code — often called the Philippine Cooperative Code of two thousand eight — with the law signed in February two thousand nine. It modernized categories of cooperatives, governance expectations, and compliance. When you hear RA ninety-five twenty, think: the main legal home of Philippine cooperatives today.",
      },
      {
        t: "The international Co-op logo",
        outline:
          "• Global symbol of unity and cooperation\n• In the international color scheme, white is assigned to the Philippines\n• Visibility of values: solidarity, self-help, responsibility",
        script:
          "The international cooperative logo — the Co-op symbol — stands for unity worldwide. In the standard color scheme, white is assigned to the Philippines, marking our place in the global family. When you see it, remember: you are part of something larger than one branch or one town — you are part of a principled movement.",
        illustration: {
          src: "/coop-international-logo.png",
          alt: "International cooperative wordmark — official Philippines display: white on dark blue",
          philippinesDisplay: true,
        },
      },
    ],
  },
  {
    id: "operations",
    title: "Module 4: How B2C works",
    icon: Workflow,
    items: [
      {
        t: "Cooperative flow",
        outline:
          "• Members → contribute → cooperative operates → services → members benefit\n• Example: pooled funds help the co-op offer loans to members in need (per policies)\n• Cycle of mutual support, not one-way extraction",
        script:
          "See the flow in one line: members contribute, the cooperative operates, services reach members, and members benefit — fairly and transparently under the rules. When members contribute funds, for example, the cooperative can provide loans to those who qualify. You are inside a cycle designed for mutual help, not for leaving anyone behind.",
      },
      {
        t: "Member contributions",
        outline:
          "• Share capital = ownership stake (per bylaws)\n• Deposits / fixed deposits = part of operational strength (rules on withdrawal apply)\n• Participation in meetings and programs = sustainability\n• Key message: No contribution, no cooperative.",
        script:
          "Contributions matter. Share capital is your ownership stake. Deposits and fixed deposits — where offered — strengthen what the cooperative can do day to day, with clear rules because that money belongs to the membership. Participation in meetings and programs keeps democracy alive. Remember this truth: no contribution, no cooperative. Everyone who benefits helps carry the load.",
      },
      {
        t: "Services for members",
        outline:
          "• Loans and credit (per policies)\n• Savings and related products\n• Goods or consumer services the co-op provides\n• Insurance and mortuary benefits where approved\n• Relate to real needs: emergency, education, business — the co-op exists to support members.",
        script:
          "Depending on B2C’s approved services, members may access loans, savings, goods, and benefits such as insurance or mortuary programs where offered. Connect it to life: an emergency, schooling, a small business — the cooperative is meant to stand with you within lawful and fair policies. Ask staff for the current list; it grows as members decide through the General Assembly.",
      },
      {
        t: "The wider cooperative ecosystem",
        outline:
          "• B2C sits in a network: federations & unions — e.g. VICTO, PCF, NATCCO, 1CoopHealth — training and advocacy\n• Government: CDA, DOLE, insurance frameworks, data privacy, BIR — enabling and regulating\n• Partners: local and international support for programs",
        script:
          "B2C does not float alone. Consumer cooperatives join federations and unions for bulk buying, training, and advocacy. Government agencies register and supervise — CDA first, then labor, social insurance, data protection, taxation, as applicable — and partners here and abroad help build capacity. Together they keep the movement accountable and growing.",
      },
    ],
  },
  {
    id: "legal",
    title: "Module 5: Law & legal basis",
    icon: Scale,
    items: [
      {
        t: "Legal basis — RA 9520",
        outline:
          "• B2C operates under Republic Act 9520 — Philippine Cooperative Code of 2008\n• Protects members and sets fair, transparent expectations\n• Types of co-ops, capital, accounts, audits — avoid reading raw legalese in seminar; focus on meaning\n• Duties of officers and rights of members — details in bylaws and policies",
        script:
          "B2C operates under Republic Act ninety-five twenty — the Philippine Cooperative Code of two thousand eight. The law protects members and helps ensure operations are fair and transparent. We are not here to read the code line by line; we want the meaning: lawful formation, clear money rules, audits when required, and space for both your rights and your responsibilities. Your bylaws and board policies spell out the day-to-day.",
      },
      {
        t: "State policy & definition (Articles 2–3)",
        outline:
          "• Article 2: State fosters cooperatives for livelihood, equity, and rural development\n• Article 3: Cooperative — autonomous association for social, economic, and cultural needs",
        script:
          "Article two states national policy: the government shall encourage cooperatives to promote full employment, equitable wealth, and rural development through self-help and responsibility. Article three defines a cooperative as a voluntary organization of persons who cooperate toward social, economic, and cultural needs — autonomous and registered under law. That is the legal soul of what you are joining.",
      },
      {
        t: "Cooperative as business — who decides",
        outline:
          "• A cooperative is a real business — unlike many others, it exists to serve members, not only to generate profit for outsiders\n• Structure: Members → General Assembly → Board of Directors → Management\n• Key message: Members hold the highest authority (law and bylaws).",
        script:
          "A cooperative is a business — but unlike a typical corporation built only for remote shareholders, it exists to serve members first. Profit or surplus is shared fairly by rules, not hoarded by a few. Power flows from members to the General Assembly, then to the board you elect, then to management running daily operations. Remember: members hold the highest authority. Democracy is not decoration; it is structure.",
      },
    ],
  },
  {
    id: "codeace",
    title: "Module 6: CODEACE principles",
    icon: Award,
    items: [
      {
        t: "CODEACE — overview",
        outline:
          "• Seven universal cooperative values (ICA)\n• Mnemonic: C-O-D-E-A-C-E\n• B2C aligns policies, PMES, and services with every letter",
        script:
          "CODEACE is your memory hook for the seven cooperative principles recognized worldwide. Together they keep the business honest, democratic, and member-centered. In B2C, every program — from this PMES to patronage and community projects — should trace back to one or more of these letters. Let us walk them one by one.",
      },
      {
        t: "C & O — Community & open membership",
        outline:
          "• C — Concern for Community: sustainable development of communities; co-op works for members and neighbors.\n  Example: outreach, scholarships, disaster help, responsible sourcing.\n• O — Open and Voluntary Membership: open to all who may use services and accept responsibilities, without discrimination.\n  Example: clear criteria in bylaws; no forced membership.",
        script:
          "First C: Concern for Community. Cooperatives exist not only to earn but to help communities thrive — economically, socially, and environmentally. For example, a consumer co-op might fund local health screening or youth programs. Next, O: Open and Voluntary Membership. Doors are open to anyone who can use the services and is willing to accept member duties, within lawful and reasonable rules — not closed clubs for a favored few.",
      },
      {
        t: "D & E — Democracy & economic stake",
        outline:
          "• D — Democratic Member Control: members set policy; typically one member, one vote for regular members.\n  Example: General Assembly approves major policies and elects the board.\n• E — Economic Participation: members contribute capital equitably and democratically control the enterprise; share surplus fairly.\n  Example: share capital, patronage refunds tied to use of the co-op.",
        script:
          "D stands for Democratic Member Control. Members own the big decisions — not distant investors. In practice, the General Assembly is the highest authority, and regular members usually have one vote each so power does not depend only on who invested more. E is Economic Participation. Members put in capital, use the co-op’s services, and share in surplus according to fair rules — for instance patronage refunds based on how much you patronize, not speculation.",
      },
      {
        t: "A & C — Autonomy & co-ops helping co-ops",
        outline:
          "• A — Autonomy and Independence: co-ops are autonomous self-help organizations; agreements preserve democratic control.\n  Example: loans or grants that do not surrender member sovereignty.\n• C — Cooperation Among Cooperatives: co-ops strengthen each other through local, national, and international structures.\n  Example: federations for bulk buying, shared training, and advocacy.",
        script:
          "A is Autonomy and Independence. Your cooperative governs itself under the law. Contracts with banks, suppliers, or government should never turn members into silent passengers — democratic control stays intact. The second C is Cooperation Among Cooperatives. B2C does not stand alone; it may join leagues and federations so many co-ops can negotiate better terms, run academies, and speak with one voice on policy.",
      },
      {
        t: "E — Education & continuous learning",
        outline:
          "• E — Education, Training, and Information: co-ops inform members, officers, and the public — especially youth and leaders.\n  Example: PMES, board training, financial literacy, transparent reports.\n• Closing: CODEACE is lived through bylaws, meetings, and daily choices",
        script:
          "The final E is Education, Training, and Information. A cooperative invests in people. This seminar is one example — you are living the principle right now. Ongoing training for directors and staff, clear reports to members, and public education about cooperative values keep the enterprise honest and strong. When you remember CODEACE, you are not reciting letters — you are describing how B2C should feel in real life.",
      },
    ],
  },
  {
    id: "governance",
    title: "Module 7: Governance & your role",
    icon: Landmark,
    items: [
      {
        t: "Responsibilities of a member",
        outline:
          "• Contribute capital and meet financial obligations on time (per policies)\n• Attend meetings when required — General Assembly, orientations, trainings\n• Support cooperative programs and values in word and action\n• Pay loans and charges faithfully — mutual trust depends on it\n• Participate actively — democracy needs voices, not silence\n• Key message: Your responsibility keeps the cooperative alive.",
        script:
          "Membership is not passive. Your responsibilities include contributing capital within the rules, attending meetings when called for, supporting programs that help the community, paying what you owe on time, and joining discussions and votes when you can. Without responsible members, no cooperative survives. Your responsibility keeps the cooperative alive.",
      },
      {
        t: "Rights of a member",
        outline:
          "• Vote on fundamental issues — typically one member, one vote for regular members\n• Be elected to the board or committees when qualified\n• Receive dividends or patronage refunds according to policies\n• Access services and information you are entitled to\n• Participate in decisions that shape the cooperative\n• Key message: You have real power in the cooperative.",
        script:
          "You also have strong rights: to vote, to run for office when qualified, to receive fair returns such as dividends or patronage refunds under the rules, to use services you are entitled to, and to help decide the cooperative’s direction. You are not a bystander. You have power — use it wisely and use it for others too.",
      },
      {
        t: "The balance — give and receive",
        outline:
          "• You do not only receive benefits — you help build them\n• Pause: honesty about what you can give and what you hope to receive\n• Rights and responsibilities go together",
        script:
          "Pause for a moment. In a cooperative you do not only receive benefits — you help build them. Benefits grow when members contribute fairly, tell the truth in meetings, and guard the common good. If you remember one thing from this section, let it be this balance: what you put in shapes what everyone can take out. That is membership with dignity.",
      },
      {
        t: "Members, assembly, and leadership",
        outline:
          "• General Assembly (GA): highest authority — you and all members in good standing\n• Board of Directors: strategic direction and policy execution\n• Committees: audit, election, ethics — integrity and checks\n• Management: day-to-day operations under board oversight",
        script:
          "In B2C, ultimate power rests with the General Assembly — that means you and every member in good standing, meeting as the law and bylaws require. You elect the Board of Directors to set direction and hold management accountable. Committees guard integrity — audit, elections, ethics. Management runs daily service under board policies. Members sit at the top — not as a slogan, but as a legal and moral fact.",
      },
    ],
  },
  {
    id: "closing",
    title: "Module 8: Reflection & next steps",
    icon: Sparkles,
    items: [
      {
        t: "Readiness — look inward",
        outline:
          "• Am I ready to commit — time, capital, and honesty?\n• Do I understand my responsibilities — not only my rights?\n• Am I willing to support the cooperative when it is easy and when it is hard?",
        script:
          "Before we close, three quiet questions — answer them for yourself, not for me. Am I ready to commit? Do I understand my responsibilities, not only my rights? Am I willing to support the cooperative?",
      },
      {
        t: "Closing — welcome to the journey",
        outline:
          "• B2C is more than a place to save or borrow — it is a community built on trust, cooperation, and shared success\n• Next: validation quiz, then B2C membership steps per office guidance\n• Padayon — forward together",
        script:
          "B2C Consumers Cooperative is more than a financial institution — it is a community built on trust, cooperation, and shared success. We are excited to grow together with you. Thank you for completing this orientation. Your next step is the short validation quiz, then follow B2C’s procedures for application, share capital, and onboarding. We look forward to you not only as a learner today, but as a member-owner who helps shape this cooperative’s future. Padayon — let us move forward together.",
      },
    ],
  },
];
