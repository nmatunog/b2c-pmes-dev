import { BadgeCheck } from "lucide-react";
import { B2CLogo } from "./B2CLogo.jsx";

function formatCertCode(id) {
  if (id == null || id === "") return "—";
  const s = String(id).replace(/-/g, "");
  return `B2C-${s.slice(0, 8).toUpperCase()}`;
}

export function Certificate({ record }) {
  const dateStr = record?.timestamp
    ? new Date(record.timestamp).toLocaleString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("en-PH");

  const score = record?.score;
  const scoreLine =
    typeof score === "number" ? `${score} / 10` : "—";

  return (
    <div className="certificate-container relative mx-auto my-4 max-w-4xl overflow-hidden rounded-[3rem] border-[24px] border-double border-[#004aad] bg-white p-8 text-center shadow-2xl print:m-0 print:max-w-none print:rounded-none print:border-[20px] print:shadow-none sm:p-12">
      <div className="absolute right-0 top-0 -mr-40 -mt-40 h-80 w-80 rounded-full border-4 border-[#004aad]/10 bg-[#004aad]/5 print:hidden" />
      <div className="relative z-10 space-y-8 sm:space-y-10">
        <div className="flex flex-col items-center gap-4">
          <B2CLogo size="xl" align="center" />
          <h2 className="text-2xl font-black uppercase tracking-tighter text-[#004aad] sm:text-3xl">B2C Consumers Cooperative</h2>
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Philippines</p>
        </div>
        <h1 className="font-serif text-4xl font-black text-slate-800 sm:text-6xl">Certificate of Completion</h1>
        <p className="text-xl font-bold italic text-slate-500 sm:text-2xl">This official document is awarded to</p>
        <h3 className="inline-block border-b-8 border-slate-100 px-4 pb-4 text-4xl font-black text-[#004aad] sm:px-8 sm:text-7xl">
          {record?.fullName || "—"}
        </h3>
        <p className="px-4 text-lg font-medium leading-relaxed text-slate-700 sm:px-16 sm:text-2xl">
          for completing the <strong>Pre-Membership Education Seminar (PMES)</strong> and achieving a passing assessment
          grade.
        </p>
        <p className="text-xl font-black text-[#004aad] sm:text-2xl">
          Assessment score: <span className="tabular-nums">{scoreLine}</span>
        </p>
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-8 border-t-2 border-slate-100 pt-8 sm:grid-cols-2 sm:gap-12">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Issued</p>
            <p className="text-lg font-black text-slate-800 sm:text-xl">{dateStr}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Certificate ID</p>
            <p className="text-lg font-black tracking-tight text-slate-800 sm:text-xl">{formatCertCode(record?.id)}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 pt-4 opacity-40 print:pt-8">
          <BadgeCheck className="h-10 w-10 text-[#004aad]" aria-hidden />
          <span className="text-sm font-black uppercase tracking-widest text-slate-600">Official record</span>
        </div>
      </div>
    </div>
  );
}
