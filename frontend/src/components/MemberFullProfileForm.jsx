import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, Lock } from "lucide-react";
import { createEmptyMemberProfile } from "../lib/memberFullProfileSchema.js";
import { profileToCsvString } from "../lib/memberProfileFlatten.js";

function Text({
  label,
  value,
  onChange,
  required,
  type = "text",
  className = "",
}) {
  return (
    <label className={`block text-[10px] font-bold uppercase tracking-wider text-slate-600 ${className}`}>
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <input
        type={type}
        className="input-field mt-1 text-sm font-medium text-slate-900"
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
export function MemberFullProfileForm({ memberEmail, onSubmitSuccess, submitting, localError }) {
  const [profile, setProfile] = useState(() => createEmptyMemberProfile());
  const [sheetFile, setSheetFile] = useState(/** @type {File | null} */ (null));

  const csvBlobUrl = useMemo(() => {
    const csv = profileToCsvString(profile);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [profile]);

  useEffect(() => {
    return () => URL.revokeObjectURL(csvBlobUrl);
  }, [csvBlobUrl]);

  const setCoop = (patch) => setProfile((p) => ({ ...p, cooperative: { ...p.cooperative, ...patch } }));
  const setAck = (patch) => setProfile((p) => ({ ...p, acknowledgement: { ...p.acknowledgement, ...patch } }));
  const setPersonal = (patch) => setProfile((p) => ({ ...p, personal: { ...p.personal, ...patch } }));
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
      cooperative: { ...profile.cooperative, emailAddress: profile.cooperative.emailAddress || memberEmail || "" },
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

      <Section title="Cooperative header" defaultOpen>
        <Text label="Cooperative address" value={profile.cooperative.address} onChange={(v) => setCoop({ address: v })} />
        <Text label="Email address" value={profile.cooperative.emailAddress} onChange={(v) => setCoop({ emailAddress: v })} />
        <Text label="Telephone number" value={profile.cooperative.telephoneNumber} onChange={(v) => setCoop({ telephoneNumber: v })} />
      </Section>

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
        <Text label="Member ID No." value={pr.memberIdNo} onChange={(v) => setPersonal({ memberIdNo: v })} />
        <Text label="Last name" value={pr.lastName} onChange={(v) => setPersonal({ lastName: v })} required />
        <Text label="First name" value={pr.firstName} onChange={(v) => setPersonal({ firstName: v })} required />
        <Text label="Middle name" value={pr.middleName} onChange={(v) => setPersonal({ middleName: v })} required />
        <Text label="Suffix name" value={pr.suffixName} onChange={(v) => setPersonal({ suffixName: v })} />
        <Text label="Nickname" value={pr.nickname} onChange={(v) => setPersonal({ nickname: v })} />
        <Text label="Birth date (mm/dd/yyyy)" value={pr.birthDate} onChange={(v) => setPersonal({ birthDate: v })} required />
        <Text label="Place of birth" value={pr.placeOfBirth} onChange={(v) => setPersonal({ placeOfBirth: v })} required />
        <Text label="Country of birth" value={pr.countryOfBirth} onChange={(v) => setPersonal({ countryOfBirth: v })} />
        <Text label="Civil status" value={pr.civilStatus} onChange={(v) => setPersonal({ civilStatus: v })} required />
        <Text label="Sex / Gender" value={pr.sexGender} onChange={(v) => setPersonal({ sexGender: v })} required />
        <Text label="Blood type" value={pr.bloodType} onChange={(v) => setPersonal({ bloodType: v })} required />
        <Text label="Height (ft & in)" value={pr.heightFeetInches} onChange={(v) => setPersonal({ heightFeetInches: v })} />
        <Text label="Weight (kg)" value={pr.weightKg} onChange={(v) => setPersonal({ weightKg: v })} />
        <Text label="No. of children" value={pr.noOfChildren} onChange={(v) => setPersonal({ noOfChildren: v })} />
        <Text label="No. of dependents" value={pr.noOfDependents} onChange={(v) => setPersonal({ noOfDependents: v })} />
        <Text
          label="Citizenship / Nationality"
          value={pr.citizenshipNationality}
          onChange={(v) => setPersonal({ citizenshipNationality: v })}
          required
        />
        <Text label="Religion" value={pr.religion} onChange={(v) => setPersonal({ religion: v })} required />
        <Text label="Social affiliations" value={pr.socialAffiliations} onChange={(v) => setPersonal({ socialAffiliations: v })} />
        <Text label="Highest education" value={pr.highestEducation} onChange={(v) => setPersonal({ highestEducation: v })} required />
      </Section>

      <Section title="Mother's information">
        <Text label="Mother's maiden last name" value={mo.maidenLastName} onChange={(v) => setMother({ maidenLastName: v })} required />
        <Text label="Mother's maiden first name" value={mo.maidenFirstName} onChange={(v) => setMother({ maidenFirstName: v })} required />
        <Text label="Mother's maiden middle name" value={mo.maidenMiddleName} onChange={(v) => setMother({ maidenMiddleName: v })} required />
        <Text label="Region" value={mo.region} onChange={(v) => setMother({ region: v })} required />
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
        <Text label="Suffix" value={fa.suffix} onChange={(v) => setFather({ suffix: v })} />
        <Text label="Region" value={fa.region} onChange={(v) => setFather({ region: v })} />
        <Text label="Province" value={fa.province} onChange={(v) => setFather({ province: v })} />
        <Text label="City / Municipality" value={fa.cityMunicipality} onChange={(v) => setFather({ cityMunicipality: v })} />
        <Text label="Barangay" value={fa.barangay} onChange={(v) => setFather({ barangay: v })} />
        <Text label="No. / Street / Subdivision" value={fa.streetSubdivision} onChange={(v) => setFather({ streetSubdivision: v })} />
        <Text label="Postal code" value={fa.postalCode} onChange={(v) => setFather({ postalCode: v })} />
      </Section>

      <Section title="Present address">
        <Text label="Country" value={pa.country} onChange={(v) => setPresent({ country: v })} required />
        <Text label="Region" value={pa.region} onChange={(v) => setPresent({ region: v })} required />
        <Text label="Province" value={pa.province} onChange={(v) => setPresent({ province: v })} required />
        <Text label="City / Municipality" value={pa.cityMunicipality} onChange={(v) => setPresent({ cityMunicipality: v })} required />
        <Text label="Barangay" value={pa.barangay} onChange={(v) => setPresent({ barangay: v })} />
        <Text label="Subdivision" value={pa.subdivision} onChange={(v) => setPresent({ subdivision: v })} required />
        <Text label="Street" value={pa.street} onChange={(v) => setPresent({ street: v })} required />
        <Text label="House No." value={pa.houseNo} onChange={(v) => setPresent({ houseNo: v })} required />
        <Text label="Postal code" value={pa.postalCode} onChange={(v) => setPresent({ postalCode: v })} />
        <Text label="Occupied since" value={pa.occupiedSince} onChange={(v) => setPresent({ occupiedSince: v })} required />
        <Text label="Living with parents (Y/N)" value={pa.livingWithParents} onChange={(v) => setPresent({ livingWithParents: v })} />
        <Text label="Rented house (Y/N)" value={pa.rentedHouse} onChange={(v) => setPresent({ rentedHouse: v })} />
        <Text label="Owned house (Y/N)" value={pa.ownedHouse} onChange={(v) => setPresent({ ownedHouse: v })} />
        <Text label="House owner if rented" value={pa.houseOwnerIfRented} onChange={(v) => setPresent({ houseOwnerIfRented: v })} />
      </Section>

      <Section title="Previous address (if applicable)">
        <Text label="Country" value={pv.country} onChange={(v) => setPrev({ country: v })} />
        <Text label="Region" value={pv.region} onChange={(v) => setPrev({ region: v })} />
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
        <Text label="Senior Citizen card" value={rne.seniorCitizenCard} onChange={(v) => setRegNE({ seniorCitizenCard: v })} />
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
        <Text label="Sector" value={em.sector} onChange={(v) => setEmp({ sector: v })} />
        <Text label="Region" value={em.region} onChange={(v) => setEmp({ region: v })} />
        <Text label="Province" value={em.province} onChange={(v) => setEmp({ province: v })} />
        <Text label="City / Municipality" value={em.cityMunicipality} onChange={(v) => setEmp({ cityMunicipality: v })} />
        <Text label="Barangay" value={em.barangay} onChange={(v) => setEmp({ barangay: v })} />
        <Text label="No. / Street / Subdivision" value={em.streetSubdivision} onChange={(v) => setEmp({ streetSubdivision: v })} />
        <Text label="Postal code" value={em.postalCode} onChange={(v) => setEmp({ postalCode: v })} />
        <Text label="Company ID No." value={em.companyIdNo} onChange={(v) => setEmp({ companyIdNo: v })} />
        <Text label="Position" value={em.position} onChange={(v) => setEmp({ position: v })} />
        <Text label="Job level" value={em.jobLevel} onChange={(v) => setEmp({ jobLevel: v })} />
        <Text label="Employment status" value={em.employmentStatus} onChange={(v) => setEmp({ employmentStatus: v })} />
        <Text label="Years of employment" value={em.yearsOfEmployment} onChange={(v) => setEmp({ yearsOfEmployment: v })} />
        <Text label="Date hired from" value={em.dateHiredFrom} onChange={(v) => setEmp({ dateHiredFrom: v })} />
        <Text label="Date hired to" value={em.dateHiredTo} onChange={(v) => setEmp({ dateHiredTo: v })} />
      </Section>

      <Section title="Self-employment or business (if applicable)">
        <Text label="Sector" value={se.sector} onChange={(v) => setSelf({ sector: v })} />
        <Text label="Sub-sector" value={se.subSector} onChange={(v) => setSelf({ subSector: v })} />
        <Text label="Occupation" value={se.occupation} onChange={(v) => setSelf({ occupation: v })} />
        <Text label="Business name" value={se.businessName} onChange={(v) => setSelf({ businessName: v })} />
        <Text label="Line of business" value={se.lineOfBusiness} onChange={(v) => setSelf({ lineOfBusiness: v })} />
        <Text label="Region" value={se.region} onChange={(v) => setSelf({ region: v })} />
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
            <Text
              label={`${i + 1} — Account type`}
              value={profile.bankAccounts[i].accountType}
              onChange={(v) => setBank(i, { accountType: v })}
              required={i === 0}
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
