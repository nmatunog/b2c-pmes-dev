import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, Lock } from "lucide-react";
import { B2CLogo } from "./B2CLogo.jsx";
import { createEmptyMemberProfile } from "../lib/memberFullProfileSchema.js";
import {
  BANK_ACCOUNT_TYPE_OPTIONS,
  BLOOD_TYPE_OPTIONS,
  CHILD_DEPENDENT_COUNT_OPTIONS,
  CITIZENSHIP_OPTIONS,
  CIVIL_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  EMPLOYMENT_SECTOR_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  HIGHEST_EDUCATION_OPTIONS,
  JOB_LEVEL_OPTIONS,
  NAME_SUFFIX_OPTIONS,
  PH_REGION_OPTIONS,
  RELIGION_OPTIONS,
  SELF_EMPLOYMENT_SECTOR_OPTIONS,
  SENIOR_CITIZEN_OPTIONS,
  SEX_GENDER_OPTIONS,
  YES_NO_NA_OPTIONS,
} from "../lib/memberFullProfileFieldOptions.js";
import { profileToCsvString } from "../lib/memberProfileFlatten.js";
import {
  formatPlaceOfBirth,
  getMunicipalitySelectOptions,
  getProvinceSelectOptions,
  parseLegacyPlaceOfBirth,
} from "../lib/phPlaceOfBirth.js";
import { auth } from "../services/firebase";
import { PmesService } from "../services/pmesService";

/** Printed on the membership sheet letterhead; also merged into submit/CSV export. */
const OFFICIAL_COOPERATIVE_ADDRESS =
  "Block 1 Lot 2D G Ouano Street, Umapad, Mandaue City, Cebu Philippines";
const OFFICIAL_COOPERATIVE_EMAIL = "b2ccoop@gmail.com";

function Text({
  label,
  value,
  onChange,
  required,
  type = "text",
  className = "",
  readOnly = false,
}) {
  return (
    <label className={`block text-[10px] font-bold uppercase tracking-wider text-slate-600 ${className}`}>
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <input
        type={type}
        readOnly={readOnly}
        className={`input-field mt-1 text-sm font-medium text-slate-900 ${
          readOnly ? "cursor-default border-slate-200/90 bg-slate-50 text-slate-800" : ""
        }`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 2 }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:col-span-2">
      {label}
      <textarea
        className="input-field mt-1 min-h-[4rem] resize-y text-sm font-medium text-slate-900"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/**
 * @param {{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean; placeholder?: string; className?: string }} props
 */
function Select({ label, value, onChange, options, required, placeholder = "Choose…", className = "" }) {
  const mergedOptions = useMemo(() => {
    const list = [...options];
    const v = String(value ?? "");
    if (v && !list.some((x) => x.value === v)) {
      list.unshift({ value: v, label: `${v} (current value)` });
    }
    return list;
  }, [options, value]);

  const hasBlankOption = mergedOptions.some((o) => o.value === "");
  const showPlaceholder = !hasBlankOption && (!required || mergedOptions.length > 0);

  return (
    <label className={`block text-[10px] font-bold uppercase tracking-wider text-slate-600 ${className}`}>
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <select
        className="input-field mt-1 text-sm font-medium text-slate-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {showPlaceholder ? <option value="">{placeholder}</option> : null}
        {mergedOptions.map((o) => (
          <option key={`${o.value}__${o.label}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children, defaultOpen = false }) {
  return (
    <details
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm open:shadow-md"
      open={defaultOpen}
    >
      <summary className="cursor-pointer select-none text-xs font-black uppercase tracking-wide text-[#004aad]">
        {title}
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}

/**
 * B2C Consumer Cooperative membership form (aligned to official Board sheet).
 */
export function MemberFullProfileForm({
  memberEmail,
  /** Server-assigned public member ID (B2C-…); shown read-only when present. */
  assignedMemberId = "",
  /** True until first full-profile submit: middle segment is registration year, not birth cohort yet. */
  memberIdIsProvisional = false,
  /** Server-normalized callsign when already saved. */
  assignedCallsign = "",
  /** After PATCH callsign, refresh membership lifecycle from parent. */
  onRefreshLifecycle,
  onSubmitSuccess,
  submitting,
  localError,
}) {
  const [profile, setProfile] = useState(() => createEmptyMemberProfile());
  const [sheetFile, setSheetFile] = useState(/** @type {File | null} */ (null));
  const [callsignMsg, setCallsignMsg] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    const id = String(assignedMemberId ?? "").trim();
    if (!id) return;
    setProfile((p) => {
      if (p.personal.memberIdNo === id) return p;
      return { ...p, personal: { ...p.personal, memberIdNo: id } };
    });
  }, [assignedMemberId]);

  /** Pioneer reclaim: names + TIN from roster check (set in App via sessionStorage). */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("b2c_pioneer_membership_prefill");
      if (!raw) return;
      const o = JSON.parse(raw);
      sessionStorage.removeItem("b2c_pioneer_membership_prefill");
      const fn = typeof o.firstName === "string" ? o.firstName.trim() : "";
      const mn = typeof o.middleName === "string" ? o.middleName.trim() : "";
      const ln = typeof o.lastName === "string" ? o.lastName.trim() : "";
      const tin = typeof o.tinNo === "string" ? o.tinNo.replace(/\D/g, "") : "";
      setProfile((p) => ({
        ...p,
        personal: {
          ...p.personal,
          ...(fn ? { firstName: fn } : {}),
          ...(mn ? { middleName: mn } : {}),
          ...(ln ? { lastName: ln } : {}),
        },
        registrationNoExpiry: {
          ...p.registrationNoExpiry,
          ...(tin ? { tinNo: tin } : {}),
        },
      }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const c = String(assignedCallsign ?? "").trim();
    if (!c) return;
    setProfile((p) => {
      if (p.personal.callsign === c) return p;
      return { ...p, personal: { ...p.personal, callsign: c } };
    });
  }, [assignedCallsign]);

  const phProvinceOptions = useMemo(() => getProvinceSelectOptions(), []);
  const phMunicipalityOptions = useMemo(
    () => getMunicipalitySelectOptions(profile.personal.placeOfBirthProvCode),
    [profile.personal.placeOfBirthProvCode],
  );

  const csvBlobUrl = useMemo(() => {
    const forExport = {
      ...profile,
      cooperative: {
        ...profile.cooperative,
        address: OFFICIAL_COOPERATIVE_ADDRESS,
        emailAddress: OFFICIAL_COOPERATIVE_EMAIL,
      },
    };
    const csv = profileToCsvString(forExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [profile]);

  useEffect(() => {
    return () => URL.revokeObjectURL(csvBlobUrl);
  }, [csvBlobUrl]);

  const setAck = (patch) => setProfile((p) => ({ ...p, acknowledgement: { ...p.acknowledgement, ...patch } }));
  const setPersonal = (patch) => setProfile((p) => ({ ...p, personal: { ...p.personal, ...patch } }));

  /** Hydrate PSGC dropdowns from legacy free-text placeOfBirth when codes are empty. */
  useEffect(() => {
    setProfile((p) => {
      const pr = p.personal;
      const hasBoth =
        String(pr.placeOfBirthProvCode ?? "").trim() !== "" &&
        String(pr.placeOfBirthMunCity ?? "").trim() !== "";
      if (hasBoth) return p;
      const parsed = parseLegacyPlaceOfBirth(pr.placeOfBirth);
      if (!parsed) return p;
      return {
        ...p,
        personal: {
          ...pr,
          placeOfBirthProvCode: parsed.provCode,
          placeOfBirthMunCity: parsed.munCity,
          placeOfBirth: formatPlaceOfBirth(parsed.provCode, parsed.munCity),
        },
      };
    });
  }, [profile.personal.placeOfBirth]);
  const setMother = (patch) => setProfile((p) => ({ ...p, mother: { ...p.mother, ...patch } }));
  const setFather = (patch) => setProfile((p) => ({ ...p, father: { ...p.father, ...patch } }));
  const setPresent = (patch) => setProfile((p) => ({ ...p, presentAddress: { ...p.presentAddress, ...patch } }));
  const setPrev = (patch) => setProfile((p) => ({ ...p, previousAddress: { ...p.previousAddress, ...patch } }));
  const setContact = (patch) => setProfile((p) => ({ ...p, contact: { ...p.contact, ...patch } }));
  const setRegNE = (patch) => setProfile((p) => ({ ...p, registrationNoExpiry: { ...p.registrationNoExpiry, ...patch } }));
  const setRegWE = (patch) => setProfile((p) => ({ ...p, registrationWithExpiry: { ...p.registrationWithExpiry, ...patch } }));
  const setSpouse = (patch) => setProfile((p) => ({ ...p, spouse: { ...p.spouse, ...patch } }));
  const setEmp = (patch) => setProfile((p) => ({ ...p, employment: { ...p.employment, ...patch } }));
  const setSelf = (patch) => setProfile((p) => ({ ...p, selfEmployment: { ...p.selfEmployment, ...patch } }));
  const setIncome = (patch) => setProfile((p) => ({ ...p, income: { ...p.income, ...patch } }));
  const setAssets = (patch) => setProfile((p) => ({ ...p, assets: { ...p.assets, ...patch } }));
  const setMappr = (patch) => setProfile((p) => ({ ...p, membershipApproval: { ...p.membershipApproval, ...patch } }));
  const setSig = (patch) => setProfile((p) => ({ ...p, signature: { ...p.signature, ...patch } }));

  const setBank = (index, patch) =>
    setProfile((p) => {
      const next = [...p.bankAccounts];
      next[index] = { ...next[index], ...patch };
      return { ...p, bankAccounts: next };
    });

  const setChild = (index, patch) =>
    setProfile((p) => {
      const next = [...p.childrenDependents];
      next[index] = { ...next[index], ...patch };
      return { ...p, childrenDependents: next };
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile.acknowledgement.consentToDataProcessing) {
      return;
    }
    const merged = {
      ...profile,
      cooperative: {
        ...profile.cooperative,
        address: OFFICIAL_COOPERATIVE_ADDRESS,
        emailAddress: OFFICIAL_COOPERATIVE_EMAIL,
      },
      contact: { ...profile.contact, emailAddress: profile.contact.emailAddress || memberEmail || "" },
    };
    await onSubmitSuccess({
      profileJson: JSON.stringify(merged),
      sheetFileName: sheetFile ? sheetFile.name : "",
      notes: profile.internalNotes || "",
    });
  };

  const pr = profile.personal;
  const mo = profile.mother;
  const fa = profile.father;
  const pa = profile.presentAddress;
  const pv = profile.previousAddress;
  const ct = profile.contact;
  const rne = profile.registrationNoExpiry;
  const rwe = profile.registrationWithExpiry;
  const sp = profile.spouse;
  const em = profile.employment;
  const se = profile.selfEmployment;
  const inc = profile.income;
  const ast = profile.assets;
  const ma = profile.membershipApproval;
  const sg = profile.signature;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm font-medium leading-relaxed text-slate-600">
        Complete all sections that apply. Fields marked <span className="text-red-600">*</span> match the paper form. Board
        approval checkboxes are recorded by staff; you may leave resolution references blank unless instructed.
      </p>

      {localError ? (
        <div className="rounded-2xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">{localError}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <a
          href={csvBlobUrl}
          download="b2c-membership-profile-draft.csv"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#004aad] underline-offset-2 hover:underline"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Download your entries as CSV
        </a>
        <label className="text-xs font-semibold text-slate-600">
          Upload completed sheet (optional)
          <input
            type="file"
            accept=".csv,.txt,.pdf,image/*"
            className="mt-1 block w-full max-w-xs text-sm"
            onChange={(e) => setSheetFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div
        className="rounded-2xl border border-[#004aad]/20 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-4"
        role="group"
        aria-label="B2C cooperative letterhead"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <B2CLogo size="sm" className="max-h-9 sm:max-h-10" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#004aad]">Official address</p>
            <p className="text-sm font-semibold leading-snug text-slate-800">{OFFICIAL_COOPERATIVE_ADDRESS}</p>
            <p className="pt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#004aad]">Email</p>
            <p className="text-sm font-semibold">
              <a
                href={`mailto:${OFFICIAL_COOPERATIVE_EMAIL}`}
                className="text-[#004aad] underline-offset-2 hover:underline"
              >
                {OFFICIAL_COOPERATIVE_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </div>

      <Section title="Acknowledgement (RA 9520, 9510, 9160)">
        <label className="flex cursor-pointer items-start gap-3 sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-[#004aad]"
            checked={profile.acknowledgement.consentToDataProcessing}
            onChange={(e) => setAck({ consentToDataProcessing: e.target.checked })}
            required
          />
          <span className="text-sm font-medium leading-relaxed text-slate-700">
            I acknowledge consent to the collection, use, processing, storage, and disposal of my personal identifiable
            information for cooperative products and services and legitimate business purposes, including compliance with RA
            9520, RA 9510, and RA 9160.
          </span>
        </label>
        <Text
          label="Signature over printed name (type your full name)"
          value={profile.acknowledgement.memberSignatureOverPrintedName}
          onChange={(v) => setAck({ memberSignatureOverPrintedName: v })}
        />
      </Section>

      <Section title="Personal information" defaultOpen>
        <div className="sm:col-span-2">
          <Text
            label="Member ID No. (assigned by B2C)"
            value={pr.memberIdNo}
            onChange={(v) => setPersonal({ memberIdNo: v })}
            readOnly={Boolean(String(assignedMemberId ?? "").trim())}
          />
          {String(assignedMemberId ?? "").trim() ? (
            <p className="mt-1.5 text-xs font-medium leading-snug text-slate-500">
              {memberIdIsProvisional ? (
                <>
                  <span className="font-semibold text-slate-700">Provisional ID:</span> the middle two digits are the year you
                  registered in this app (e.g. 26 for 2026) when your account had no date of birth on file. After you submit
                  this form with your <span className="font-semibold">legal date of birth</span>, the server assigns your{" "}
                  <span className="font-semibold">permanent</span> member ID using your birth-year cohort. The last segment
                  stays random for security.
                </>
              ) : (
                <>
                  Your initials and birth-year cohort are in this code; the last segment is random so others cannot guess
                  valid IDs. Use this number on cooperative paperwork and when staff asks for your member ID.
                </>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-xs font-medium text-slate-500">
              Your member ID appears here automatically once the server assigns it (usually when this page loads).
            </p>
          )}
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Text label="Callsign (optional)" value={pr.callsign} onChange={(v) => setPersonal({ callsign: v })} />
          <p className="text-xs font-medium leading-snug text-slate-500">
            Shown as your <span className="font-semibold text-slate-700">alternate label</span> alongside your Member ID. If
            you leave this blank, the server assigns{' '}
            <span className="font-mono text-slate-800">lastname-1</span>, <span className="font-mono text-slate-800">-2</span>
            , … from your legal surname below (for siblings with the same family name).
          </p>
          {onRefreshLifecycle && memberEmail ? (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                className="inline-flex min-h-[40px] items-center rounded-xl border-2 border-[#004aad]/30 bg-white px-4 text-sm font-black uppercase tracking-wide text-[#004aad] transition hover:bg-[#004aad]/5"
                onClick={async () => {
                  setCallsignMsg(null);
                  try {
                    const u = auth.currentUser;
                    if (!u) {
                      setCallsignMsg("Sign in required.");
                      return;
                    }
                    const token = await u.getIdToken();
                    await PmesService.patchMemberCallsign({
                      email: memberEmail,
                      callsign: pr.callsign?.trim() ?? "",
                      idToken: token,
                    });
                    await onRefreshLifecycle();
                    setCallsignMsg("Saved.");
                  } catch (e) {
                    setCallsignMsg(e instanceof Error ? e.message : "Could not save.");
                  }
                }}
              >
                Save callsign now
              </button>
              {callsignMsg ? <span className="text-sm font-medium text-slate-600">{callsignMsg}</span> : null}
            </div>
          ) : null}
        </div>
        <Text label="Last name" value={pr.lastName} onChange={(v) => setPersonal({ lastName: v })} required />
        <Text label="First name" value={pr.firstName} onChange={(v) => setPersonal({ firstName: v })} required />
        <Text label="Middle name" value={pr.middleName} onChange={(v) => setPersonal({ middleName: v })} required />
        <Select
          label="Suffix name"
          value={pr.suffixName}
          onChange={(v) => setPersonal({ suffixName: v })}
          options={NAME_SUFFIX_OPTIONS}
          placeholder="None"
        />
        <Text label="Nickname" value={pr.nickname} onChange={(v) => setPersonal({ nickname: v })} />
        <Text label="Birth date (mm/dd/yyyy)" value={pr.birthDate} onChange={(v) => setPersonal({ birthDate: v })} required />
        <Select
          label="Province (place of birth)"
          value={pr.placeOfBirthProvCode}
          onChange={(v) =>
            setPersonal({
              placeOfBirthProvCode: v,
              placeOfBirthMunCity: "",
              placeOfBirth: "",
            })
          }
          options={phProvinceOptions}
          required
          placeholder="Select province"
        />
        <Select
          label="City / municipality"
          value={pr.placeOfBirthMunCity}
          onChange={(v) =>
            setPersonal({
              placeOfBirthMunCity: v,
              placeOfBirth: formatPlaceOfBirth(pr.placeOfBirthProvCode, v),
            })
          }
          options={phMunicipalityOptions}
          required
          placeholder={pr.placeOfBirthProvCode ? "Select city or municipality" : "Select province first"}
        />
        <Select
          label="Country of birth"
          value={pr.countryOfBirth}
          onChange={(v) => setPersonal({ countryOfBirth: v })}
          options={COUNTRY_OPTIONS}
          placeholder="Select country"
        />
        <Select
          label="Civil status"
          value={pr.civilStatus}
          onChange={(v) => setPersonal({ civilStatus: v })}
          options={CIVIL_STATUS_OPTIONS}
          required
          placeholder="Select civil status"
        />
        <Select
          label="Sex / Gender"
          value={pr.sexGender}
          onChange={(v) => setPersonal({ sexGender: v })}
          options={SEX_GENDER_OPTIONS}
          required
          placeholder="Select"
        />
        <Select
          label="Blood type"
          value={pr.bloodType}
          onChange={(v) => setPersonal({ bloodType: v })}
          options={BLOOD_TYPE_OPTIONS}
          required
          placeholder="Select blood type"
        />
        <Text label="Height (ft & in)" value={pr.heightFeetInches} onChange={(v) => setPersonal({ heightFeetInches: v })} />
        <Text label="Weight (kg)" value={pr.weightKg} onChange={(v) => setPersonal({ weightKg: v })} />
        <Select
          label="No. of children"
          value={pr.noOfChildren}
          onChange={(v) => setPersonal({ noOfChildren: v })}
          options={CHILD_DEPENDENT_COUNT_OPTIONS}
          placeholder="Select"
        />
        <Select
          label="No. of dependents"
          value={pr.noOfDependents}
          onChange={(v) => setPersonal({ noOfDependents: v })}
          options={CHILD_DEPENDENT_COUNT_OPTIONS}
          placeholder="Select"
        />
        <Select
          label="Citizenship / Nationality"
          value={pr.citizenshipNationality}
          onChange={(v) => setPersonal({ citizenshipNationality: v })}
          options={CITIZENSHIP_OPTIONS}
          required
          placeholder="Select"
        />
        <Select
          label="Religion"
          value={pr.religion}
          onChange={(v) => setPersonal({ religion: v })}
          options={RELIGION_OPTIONS}
          required
          placeholder="Select"
        />
        <Text label="Social affiliations" value={pr.socialAffiliations} onChange={(v) => setPersonal({ socialAffiliations: v })} />
        <Select
          label="Highest education"
          value={pr.highestEducation}
          onChange={(v) => setPersonal({ highestEducation: v })}
          options={HIGHEST_EDUCATION_OPTIONS}
          required
          placeholder="Select education"
        />
      </Section>

      <Section title="Mother's information">
        <Text label="Mother's maiden last name" value={mo.maidenLastName} onChange={(v) => setMother({ maidenLastName: v })} required />
        <Text label="Mother's maiden first name" value={mo.maidenFirstName} onChange={(v) => setMother({ maidenFirstName: v })} required />
        <Text label="Mother's maiden middle name" value={mo.maidenMiddleName} onChange={(v) => setMother({ maidenMiddleName: v })} required />
        <Select
          label="Region"
          value={mo.region}
          onChange={(v) => setMother({ region: v })}
          options={PH_REGION_OPTIONS}
          required
          placeholder="Select region"
        />
        <Text label="Province" value={mo.province} onChange={(v) => setMother({ province: v })} required />
        <Text label="City / Municipality" value={mo.cityMunicipality} onChange={(v) => setMother({ cityMunicipality: v })} required />
        <Text label="Barangay" value={mo.barangay} onChange={(v) => setMother({ barangay: v })} />
        <Text label="No. / Street / Subdivision" value={mo.streetSubdivision} onChange={(v) => setMother({ streetSubdivision: v })} />
        <Text label="Postal code" value={mo.postalCode} onChange={(v) => setMother({ postalCode: v })} />
      </Section>

      <Section title="Father's information">
        <Text label="Father's last name" value={fa.lastName} onChange={(v) => setFather({ lastName: v })} />
        <Text label="Father's first name" value={fa.firstName} onChange={(v) => setFather({ firstName: v })} />
        <Text label="Father's middle name" value={fa.middleName} onChange={(v) => setFather({ middleName: v })} />
        <Select
          label="Suffix"
          value={fa.suffix}
          onChange={(v) => setFather({ suffix: v })}
          options={NAME_SUFFIX_OPTIONS}
          placeholder="None"
        />
        <Select
          label="Region"
          value={fa.region}
          onChange={(v) => setFather({ region: v })}
          options={PH_REGION_OPTIONS}
          placeholder="Select region"
        />
        <Text label="Province" value={fa.province} onChange={(v) => setFather({ province: v })} />
        <Text label="City / Municipality" value={fa.cityMunicipality} onChange={(v) => setFather({ cityMunicipality: v })} />
        <Text label="Barangay" value={fa.barangay} onChange={(v) => setFather({ barangay: v })} />
        <Text label="No. / Street / Subdivision" value={fa.streetSubdivision} onChange={(v) => setFather({ streetSubdivision: v })} />
        <Text label="Postal code" value={fa.postalCode} onChange={(v) => setFather({ postalCode: v })} />
      </Section>

      <Section title="Present address">
        <Select
          label="Country"
          value={pa.country}
          onChange={(v) => setPresent({ country: v })}
          options={COUNTRY_OPTIONS}
          required
          placeholder="Select country"
        />
        <Select
          label="Region"
          value={pa.region}
          onChange={(v) => setPresent({ region: v })}
          options={PH_REGION_OPTIONS}
          required
          placeholder="Select region"
        />
        <Text label="Province" value={pa.province} onChange={(v) => setPresent({ province: v })} required />
        <Text label="City / Municipality" value={pa.cityMunicipality} onChange={(v) => setPresent({ cityMunicipality: v })} required />
        <Text label="Barangay" value={pa.barangay} onChange={(v) => setPresent({ barangay: v })} />
        <Text label="Subdivision" value={pa.subdivision} onChange={(v) => setPresent({ subdivision: v })} required />
        <Text label="Street" value={pa.street} onChange={(v) => setPresent({ street: v })} required />
        <Text label="House No." value={pa.houseNo} onChange={(v) => setPresent({ houseNo: v })} required />
        <Text label="Postal code" value={pa.postalCode} onChange={(v) => setPresent({ postalCode: v })} />
        <Text label="Occupied since" value={pa.occupiedSince} onChange={(v) => setPresent({ occupiedSince: v })} required />
        <Select
          label="Living with parents"
          value={pa.livingWithParents}
          onChange={(v) => setPresent({ livingWithParents: v })}
          options={YES_NO_NA_OPTIONS}
          placeholder="Select"
        />
        <Select
          label="Rented house"
          value={pa.rentedHouse}
          onChange={(v) => setPresent({ rentedHouse: v })}
          options={YES_NO_NA_OPTIONS}
          placeholder="Select"
        />
        <Select
          label="Owned house"
          value={pa.ownedHouse}
          onChange={(v) => setPresent({ ownedHouse: v })}
          options={YES_NO_NA_OPTIONS}
          placeholder="Select"
        />
        <Text label="House owner if rented" value={pa.houseOwnerIfRented} onChange={(v) => setPresent({ houseOwnerIfRented: v })} />
      </Section>

      <Section title="Previous address (if applicable)">
        <Select
          label="Country"
          value={pv.country}
          onChange={(v) => setPrev({ country: v })}
          options={COUNTRY_OPTIONS}
          placeholder="Select country"
        />
        <Select
          label="Region"
          value={pv.region}
          onChange={(v) => setPrev({ region: v })}
          options={PH_REGION_OPTIONS}
          placeholder="Select region"
        />
        <Text label="Province" value={pv.province} onChange={(v) => setPrev({ province: v })} />
        <Text label="City / Municipality" value={pv.cityMunicipality} onChange={(v) => setPrev({ cityMunicipality: v })} />
        <Text label="Barangay" value={pv.barangay} onChange={(v) => setPrev({ barangay: v })} />
        <Text label="Subdivision" value={pv.subdivision} onChange={(v) => setPrev({ subdivision: v })} />
        <Text label="Street" value={pv.street} onChange={(v) => setPrev({ street: v })} />
        <Text label="House No." value={pv.houseNo} onChange={(v) => setPrev({ houseNo: v })} />
        <Text label="Postal code" value={pv.postalCode} onChange={(v) => setPrev({ postalCode: v })} />
        <Text label="Period from" value={pv.periodDateFrom} onChange={(v) => setPrev({ periodDateFrom: v })} />
        <Text label="Period to" value={pv.periodDateTo} onChange={(v) => setPrev({ periodDateTo: v })} />
      </Section>

      <Section title="Contact information">
        <Text label="Home phone area code" value={ct.homePhoneAreaCode} onChange={(v) => setContact({ homePhoneAreaCode: v })} />
        <Text label="Home phone No." value={ct.homePhoneNo} onChange={(v) => setContact({ homePhoneNo: v })} />
        <Text label="Mobile No." value={ct.mobileNo} onChange={(v) => setContact({ mobileNo: v })} required />
        <Text label="Office phone area code" value={ct.officePhoneAreaCode} onChange={(v) => setContact({ officePhoneAreaCode: v })} />
        <Text label="Office phone No." value={ct.officePhoneNo} onChange={(v) => setContact({ officePhoneNo: v })} />
        <Text label="Email address" value={ct.emailAddress} onChange={(v) => setContact({ emailAddress: v })} />
      </Section>

      <Section title="Registration numbers (no expiry)">
        <Text label="TIN No." value={rne.tinNo} onChange={(v) => setRegNE({ tinNo: v })} required />
        <Text label="SSS No." value={rne.sssNo} onChange={(v) => setRegNE({ sssNo: v })} />
        <Text label="GSIS No." value={rne.gsisNo} onChange={(v) => setRegNE({ gsisNo: v })} />
        <Text label="UMID No." value={rne.umidNo} onChange={(v) => setRegNE({ umidNo: v })} />
        <Text label="Philhealth or Pag-ibig No." value={rne.philhealthOrPagibigNo} onChange={(v) => setRegNE({ philhealthOrPagibigNo: v })} />
        <Select
          label="Senior Citizen card"
          value={rne.seniorCitizenCard}
          onChange={(v) => setRegNE({ seniorCitizenCard: v })}
          options={SENIOR_CITIZEN_OPTIONS}
          placeholder="Select"
        />
      </Section>

      <Section title="Registration numbers (with expiry)">
        <Text label="Driver's License No." value={rwe.driversLicenseNo} onChange={(v) => setRegWE({ driversLicenseNo: v })} />
        <Text label="Driver's License issued" value={rwe.driversLicenseIssuedDate} onChange={(v) => setRegWE({ driversLicenseIssuedDate: v })} />
        <Text label="Driver's License expiry" value={rwe.driversLicenseExpiryDate} onChange={(v) => setRegWE({ driversLicenseExpiryDate: v })} />
        <Text label="Passport ID No." value={rwe.passportIdNo} onChange={(v) => setRegWE({ passportIdNo: v })} />
        <Text label="Passport issued" value={rwe.passportIssuedDate} onChange={(v) => setRegWE({ passportIssuedDate: v })} />
        <Text label="Passport expiry" value={rwe.passportExpiryDate} onChange={(v) => setRegWE({ passportExpiryDate: v })} />
        <Text label="PRC ID No." value={rwe.prcIdNo} onChange={(v) => setRegWE({ prcIdNo: v })} />
        <Text label="PRC ID issued" value={rwe.prcIdIssuedDate} onChange={(v) => setRegWE({ prcIdIssuedDate: v })} />
        <Text label="PRC ID expiry" value={rwe.prcIdExpiryDate} onChange={(v) => setRegWE({ prcIdExpiryDate: v })} />
        <Text label="Postal ID No." value={rwe.postalIdNo} onChange={(v) => setRegWE({ postalIdNo: v })} />
        <Text label="Postal ID issued" value={rwe.postalIdIssuedDate} onChange={(v) => setRegWE({ postalIdIssuedDate: v })} />
        <Text label="Postal ID expiry" value={rwe.postalIdExpiryDate} onChange={(v) => setRegWE({ postalIdExpiryDate: v })} />
      </Section>

      <Section title="Spouse (if applicable)">
        <Text label="Last name" value={sp.lastName} onChange={(v) => setSpouse({ lastName: v })} />
        <Text label="First name" value={sp.firstName} onChange={(v) => setSpouse({ firstName: v })} />
        <Text label="Middle name" value={sp.middleName} onChange={(v) => setSpouse({ middleName: v })} />
        <Text label="Maiden name" value={sp.maidenName} onChange={(v) => setSpouse({ maidenName: v })} />
        <Text label="Company name" value={sp.companyName} onChange={(v) => setSpouse({ companyName: v })} />
        <TextArea label="Employer address" value={sp.employerAddress || ""} onChange={(v) => setSpouse({ employerAddress: v })} />
        <Text label="Office phone No." value={sp.officePhoneNo} onChange={(v) => setSpouse({ officePhoneNo: v })} />
        <Text label="Mobile No." value={sp.mobileNo} onChange={(v) => setSpouse({ mobileNo: v })} />
        <Text label="Email address" value={sp.emailAddress} onChange={(v) => setSpouse({ emailAddress: v })} />
      </Section>

      <Section title="Employment information">
        <Text label="Company" value={em.company} onChange={(v) => setEmp({ company: v })} />
        <Select
          label="Sector"
          value={em.sector}
          onChange={(v) => setEmp({ sector: v })}
          options={EMPLOYMENT_SECTOR_OPTIONS}
          placeholder="Select sector"
        />
        <Select
          label="Region"
          value={em.region}
          onChange={(v) => setEmp({ region: v })}
          options={PH_REGION_OPTIONS}
          placeholder="Select region"
        />
        <Text label="Province" value={em.province} onChange={(v) => setEmp({ province: v })} />
        <Text label="City / Municipality" value={em.cityMunicipality} onChange={(v) => setEmp({ cityMunicipality: v })} />
        <Text label="Barangay" value={em.barangay} onChange={(v) => setEmp({ barangay: v })} />
        <Text label="No. / Street / Subdivision" value={em.streetSubdivision} onChange={(v) => setEmp({ streetSubdivision: v })} />
        <Text label="Postal code" value={em.postalCode} onChange={(v) => setEmp({ postalCode: v })} />
        <Text label="Company ID No." value={em.companyIdNo} onChange={(v) => setEmp({ companyIdNo: v })} />
        <Text label="Position" value={em.position} onChange={(v) => setEmp({ position: v })} />
        <Select
          label="Job level"
          value={em.jobLevel}
          onChange={(v) => setEmp({ jobLevel: v })}
          options={JOB_LEVEL_OPTIONS}
          placeholder="Select"
        />
        <Select
          label="Employment status"
          value={em.employmentStatus}
          onChange={(v) => setEmp({ employmentStatus: v })}
          options={EMPLOYMENT_STATUS_OPTIONS}
          placeholder="Select"
        />
        <Text label="Years of employment" value={em.yearsOfEmployment} onChange={(v) => setEmp({ yearsOfEmployment: v })} />
        <Text label="Date hired from" value={em.dateHiredFrom} onChange={(v) => setEmp({ dateHiredFrom: v })} />
        <Text label="Date hired to" value={em.dateHiredTo} onChange={(v) => setEmp({ dateHiredTo: v })} />
      </Section>

      <Section title="Self-employment or business (if applicable)">
        <Select
          label="Sector"
          value={se.sector}
          onChange={(v) => setSelf({ sector: v })}
          options={SELF_EMPLOYMENT_SECTOR_OPTIONS}
          placeholder="Select sector"
        />
        <Text label="Sub-sector" value={se.subSector} onChange={(v) => setSelf({ subSector: v })} />
        <Text label="Occupation" value={se.occupation} onChange={(v) => setSelf({ occupation: v })} />
        <Text label="Business name" value={se.businessName} onChange={(v) => setSelf({ businessName: v })} />
        <Text label="Line of business" value={se.lineOfBusiness} onChange={(v) => setSelf({ lineOfBusiness: v })} />
        <Select
          label="Region"
          value={se.region}
          onChange={(v) => setSelf({ region: v })}
          options={PH_REGION_OPTIONS}
          placeholder="Select region"
        />
        <Text label="Province" value={se.province} onChange={(v) => setSelf({ province: v })} />
        <Text label="City / Municipality" value={se.cityMunicipality} onChange={(v) => setSelf({ cityMunicipality: v })} />
        <Text label="Barangay" value={se.barangay} onChange={(v) => setSelf({ barangay: v })} />
        <Text label="No. / Street / Subdivision" value={se.streetSubdivision} onChange={(v) => setSelf({ streetSubdivision: v })} />
        <Text label="Postal code" value={se.postalCode} onChange={(v) => setSelf({ postalCode: v })} />
      </Section>

      <Section title="Income information">
        <Text label="Salary (annual)" value={inc.salaryAnnual} onChange={(v) => setIncome({ salaryAnnual: v })} required />
        <Text label="Business income (annual)" value={inc.businessIncomeAnnual} onChange={(v) => setIncome({ businessIncomeAnnual: v })} />
        <Text label="Other income (annual)" value={inc.otherIncomeAnnual} onChange={(v) => setIncome({ otherIncomeAnnual: v })} />
        <Text label="Spouse salary (annual)" value={inc.spouseSalaryAnnual} onChange={(v) => setIncome({ spouseSalaryAnnual: v })} />
        <Text label="Spouse business income (annual)" value={inc.spouseBusinessIncomeAnnual} onChange={(v) => setIncome({ spouseBusinessIncomeAnnual: v })} />
      </Section>

      <Section title="Bank accounts">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <Text
              label={`${i + 1} — Bank name`}
              value={profile.bankAccounts[i].bankName}
              onChange={(v) => setBank(i, { bankName: v })}
              required={i === 0}
            />
            <Select
              label={`${i + 1} — Account type`}
              value={profile.bankAccounts[i].accountType}
              onChange={(v) => setBank(i, { accountType: v })}
              options={BANK_ACCOUNT_TYPE_OPTIONS}
              required={i === 0}
              placeholder="Select account type"
            />
          </div>
        ))}
      </Section>

      <Section title="Assets">
        <Text label="Car owned 1" value={ast.carOwned1} onChange={(v) => setAssets({ carOwned1: v })} />
        <Text label="Car owned 2" value={ast.carOwned2} onChange={(v) => setAssets({ carOwned2: v })} />
        <Text label="Car owned 3" value={ast.carOwned3} onChange={(v) => setAssets({ carOwned3: v })} />
        <Text label="Car owned 4" value={ast.carOwned4} onChange={(v) => setAssets({ carOwned4: v })} />
        <Text label="Car owned 5" value={ast.carOwned5} onChange={(v) => setAssets({ carOwned5: v })} />
        <Text label="Other assets 1" value={ast.otherAssets1} onChange={(v) => setAssets({ otherAssets1: v })} required />
        <Text label="Other assets 2" value={ast.otherAssets2} onChange={(v) => setAssets({ otherAssets2: v })} />
        <Text label="Other assets 3" value={ast.otherAssets3} onChange={(v) => setAssets({ otherAssets3: v })} />
        <Text label="Other assets 4" value={ast.otherAssets4} onChange={(v) => setAssets({ otherAssets4: v })} />
        <Text label="Other assets 5" value={ast.otherAssets5} onChange={(v) => setAssets({ otherAssets5: v })} />
      </Section>

      <Section title="Membership approval (Board — reference only)">
        <p className="text-xs font-medium text-slate-500 sm:col-span-2">
          Official approval is recorded by the cooperative. You may enter resolution details only if staff asked you to.
        </p>
        <Text label="Board resolution No." value={ma.boardResolutionNo} onChange={(v) => setMappr({ boardResolutionNo: v })} />
        <Text label="Board resolution date" value={ma.boardResolutionDate} onChange={(v) => setMappr({ boardResolutionDate: v })} />
        <Text label="Board Secretary (name)" value={ma.boardSecretaryName} onChange={(v) => setMappr({ boardSecretaryName: v })} />
        <TextArea label="Internal note (staff)" value={ma.memberNotes} onChange={(v) => setMappr({ memberNotes: v })} rows={2} />
      </Section>

      <Section title="Children / dependents">
        {profile.childrenDependents.map((row, i) => (
          <div key={i} className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <Text
              label={`Child / dependent ${i + 1} — Name`}
              value={row.nameOfChildDependent}
              onChange={(v) => setChild(i, { nameOfChildDependent: v })}
              required={i === 0}
            />
            <Text
              label={`Child / dependent ${i + 1} — Birth date`}
              value={row.birthDate}
              onChange={(v) => setChild(i, { birthDate: v })}
              required={i === 0}
            />
          </div>
        ))}
      </Section>

      <Section title="Member signature">
        <Text
          label="Signature over printed name"
          value={sg.memberSignatureOverPrintedName}
          onChange={(v) => setSig({ memberSignatureOverPrintedName: v })}
        />
        <Text label="Date" value={sg.date} onChange={(v) => setSig({ date: v })} />
        <TextArea
          label="Notes for membership desk"
          value={profile.internalNotes}
          onChange={(v) => setProfile((p) => ({ ...p, internalNotes: v }))}
          rows={3}
        />
      </Section>

      <button
        type="submit"
        disabled={submitting || !profile.acknowledgement.consentToDataProcessing}
        className="btn-primary flex w-full items-center justify-center gap-2 py-4 sm:w-auto"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Lock className="h-5 w-5" aria-hidden />}
        Submit membership form
      </button>
    </form>
  );
}
