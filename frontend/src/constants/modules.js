import { Award, BookOpen, History, Landmark, Network, Scale, Sparkles, Users } from "lucide-react";

/**
 * PMES narrative modules — aligned with B2C presentation / VO script (full seminar).
 * Scripts favor natural Ka-uban delivery; outlines are scannable bullets for the UI.
 */
export const modules = [
  {
    id: "welcome",
    title: "Module 1: Welcome",
    icon: Users,
    items: [
      {
        t: "Welcome to PMES",
        outline:
          "• Official: B2C Consumers Cooperative Pre-Membership Education Seminar\n• Purpose: Understand how to join and what membership means\n• Your guide: Ka-uban — partner on this journey",
        script:
          "Good day! Welcome to the B2C Consumers Cooperative Pre-Membership Education Seminar. I am Ka-uban, your companion today. In our language, Ka-uban means partner — and that is what I am here for. Today we walk through why cooperatives matter, how B2C works, and how you can take the next step as a future member-owner. Let us begin together.",
      },
      {
        t: "Why are you here?",
        outline:
          "• Compliance with membership requirements\n• Learning what a cooperative really is\n• Invitation from a friend or sponsor\n• Exploring opportunities — livelihood, savings, community",
        script:
          "Why are you here today? Some of you need this seminar for compliance before membership. Others want clear information about cooperatives. Maybe a friend invited you, or you are curious about opportunities — savings, loans, patronage, or serving the community. Whatever your reason, this short journey will give you honest, practical insight so you can decide with confidence. Let us move forward side by side.",
      },
    ],
  },
  {
    id: "basics",
    title: "Module 2: What is a cooperative?",
    icon: BookOpen,
    items: [
      {
        t: "Definition",
        outline:
          "• People with a common bond pooling resources\n• A business that serves members’ needs\n• Pursues social and economic objectives — not profit for outsiders alone",
        script:
          "What is a cooperative? It is an organization of people with a common bond who put resources together to run a business that answers their needs. It is still a real business — but it exists to serve members and the community, not to enrich a single owner. Social objectives sit beside economic ones. In B2C, that spirit is exactly what we protect.",
      },
      {
        t: "How it works",
        outline:
          "• Shared capital and fixed deposits — rules on withdrawal\n• Monthly or regular contributions where applicable\n• Patronage: use the co-op’s services and share in surplus fairly\n• Every member is an owner — one member, one vote in principle",
        script:
          "Here is how it works in practice. Members invest through shared capital or fixed deposits, often with a minimum contribution and clear rules — because that money powers programs for everyone. You patronize the cooperative’s products and services, and benefits can include fair pricing, patronage refunds, and dividends according to policies. You are not just a customer; you are an owner. That is the cooperative difference.",
      },
      {
        t: "Cooperative services",
        outline:
          "• Insurance and mortuary benefits (where offered)\n• Savings, credit, and asset-building products\n• Other member benefits as approved by the GA and policies",
        script:
          "Cooperatives are not only about a single product. Depending on the co-op’s type and approval, members may access insurance or mortuary benefits, savings and loans, and other services designed for members’ security and growth. The list grows as members decide through democratic processes. The point is mutual help — not leaving anyone to face life’s costs alone.",
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
    ],
  },
  {
    id: "ecosystem",
    title: "Module 4: Ecosystem & identity",
    icon: Network,
    items: [
      {
        t: "The cooperative ecosystem",
        outline:
          "• Owned by members; embedded in communities\n• Federations & unions: e.g. VICTO, PCF, NATCCO, 1CoopHealth — shared services and advocacy\n• Government: CDA, DOLE, cooperative insurance, data privacy, BIR — enabling and regulating\n• Partners: local and international support for training and programs",
        script:
          "A cooperative does not stand alone. It lives inside an ecosystem: members and communities first; then federations and unions that link co-ops for training, marketing, and advocacy; then government agencies that register and supervise — CDA, labor and social programs where relevant, insurance frameworks, data protection, taxation rules — and partners here and abroad who help build capacity. Together they keep the movement honest and strong.",
      },
      {
        t: "Nature of co-ops — COOPS",
        outline:
          "• Capitalized by members\n• Owned by members\n• Operated by elected leaders under democratic control\n• Patronized by members — use what you own\n• Service-oriented — people before pure profit",
        script:
          "Remember the word COOPS as a memory aid. Capitalized by members. Owned by members. Operated by leaders you elect, under democratic rules. Patronized by members — you use the services you collectively own. And service-oriented — success is measured in member and community welfare, not exploitation. Say it with me: COOPS.",
      },
      {
        t: "The international Co-op logo",
        outline:
          "• Global symbol of unity and cooperation\n• White in the design is assigned to the Philippines in the international scheme\n• Visibility of values: solidarity, self-help, responsibility",
        script:
          "The international cooperative logo — the Co-op symbol — stands for unity worldwide. In the standard color scheme, white is assigned to the Philippines, marking our place in the global family. When you see it, remember: you are part of something larger than one branch or one town — you are part of a principled movement.",
      },
    ],
  },
  {
    id: "legal",
    title: "Module 5: Law & legal basis",
    icon: Scale,
    items: [
      {
        t: "Governing law — RA 9520",
        outline:
          "• Philippine Cooperative Code of 2008\n• Types of cooperatives, capital, accounts, audits, disputes\n• Duties of officers and rights of members — read bylaws and policies",
        script:
          "Republic Act ninety-five twenty is your governing law — the Philippine Cooperative Code of two thousand eight. It tells us how cooperatives are formed, classified, capitalized, audited, and dissolved when needed. It protects members’ rights and officers’ duties. B2C operates inside this frame; your bylaws and board policies fill in the day-to-day rules.",
      },
      {
        t: "State policy & definition (Articles 2–3)",
        outline:
          "• Article 2: State fosters cooperatives for livelihood, equity, and rural development\n• Article 3: Cooperative — autonomous association for social, economic, and cultural needs",
        script:
          "Article two states national policy: the government shall encourage cooperatives to promote full employment, equitable wealth, and rural development through self-help and responsibility. Article three defines a cooperative as a voluntary organization of persons who cooperate toward social, economic, and cultural needs — autonomous and registered under law. That is the legal soul of what you are joining.",
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
    title: "Module 7: Governance in B2C",
    icon: Landmark,
    items: [
      {
        t: "Members, assembly, and leadership",
        outline:
          "• General Assembly (GA): highest authority — you and all members\n• Board of Directors: strategic direction and policy execution\n• Committees: audit, election, ethics — integrity and checks\n• Management: day-to-day operations under board oversight",
        script:
          "In B2C, ultimate power rests with the General Assembly — that means you and every member in good standing, meeting as the law and bylaws require. You elect the Board of Directors to set direction and hold management accountable. Committees guard integrity — audit, elections, ethics. Management runs daily service under board policies. Democracy is not a poster; it is a structure you participate in.",
      },
    ],
  },
  {
    id: "closing",
    title: "Module 8: Next steps",
    icon: Sparkles,
    items: [
      {
        t: "Complete your orientation",
        outline:
          "• Review key points from each module\n• Take the validation quiz — demonstrates understanding\n• Follow B2C procedures for membership application and share capital\n• Welcome — your cooperative journey continues with real participation",
        script:
          "Thank you for staying with this seminar. You have seen why cooperatives exist, how Philippine law supports them, how B2C fits in that story, and what CODEACE demands of us all. Your next step is the validation quiz — a short check that you understood the essentials. After that, follow B2C’s process for application, capital build-up, and onboarding. We look forward to you not only as a learner today, but as a member-owner who shapes this cooperative’s future. Padayon — let us move forward together.",
      },
    ],
  },
];
