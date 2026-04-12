import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Info, Loader2, Lock, Upload, X } from "lucide-react";
import { B2CLogo } from "./B2CLogo.jsx";
import { SignatureDrawPad } from "./SignatureDrawPad.jsx";
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
  HEIGHT_FEET_OPTIONS,
  HEIGHT_INCHES_OPTIONS,
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
import { formatHeightFeetInches, parseHeightFeetInches } from "../lib/memberHeightFormat.js";
import {
  mapRegistrationGenderToSexGender,
  registrationDobToBirthDate,
  splitFullNameForPrefill,
} from "../lib/membershipFormPrefill.js";
import {
  clearMemberProfileDraft,
  loadMemberProfileDraft,
  memberProfileDraftKey,
  saveMemberProfileDraft,
} from "../lib/memberProfileDraftStorage.js";
import { profileToCsvString } from "../lib/memberProfileFlatten.js";
import { compressImageFileToJpegDataUrl } from "../lib/signatureImage.js";
import { auth } from "../services/firebase";
import { PmesService } from "../services/pmesService";

/** Printed on the membership sheet letterhead; also merged into submit/CSV export. */
const OFFICIAL_COOPERATIVE_ADDRESS =
  "Block 1 Lot 2D G Ouano Street, Umapad, Mandaue City, Cebu Philippines";
const OFFICIAL_COOPERATIVE_EMAIL = "b2ccoop@gmail.com";

const SUBMIT_TIMEOUT_MS = 120_000;

/**
 * Printed name appears under Acknowledgement and again under Member signature; either counts for submit.
 * @param {{ acknowledgement: { memberSignatureOverPrintedName?: string }; signature: { memberSignatureOverPrintedName?: string } }} profile
 */
function getSignaturePrintedName(profile) {
  const sig = String(profile.signature?.memberSignatureOverPrintedName ?? "").trim();
  const ack = String(profile.acknowledgement?.memberSignatureOverPrintedName ?? "").trim();
  return sig || ack;
}

/** @param {unknown} err */
function formatSubmitError(err) {
  if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
    return "The request timed out or was cancelled. Check your connection and try again.";
  }
  if (err instanceof TypeError && /fetch|network|load failed/i.test(String(err.message))) {
    return "Network error — you may be offline or the server is unreachable. Check your connection and try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Submission failed.";
}

/**
 * @param {{ type: "success" | "error" | "info"; title: string; message: string }} t
 */
function FormToast({ toast, onDismiss }) {
  if (!toast) return null;
  const styles =
    toast.type === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
      : toast.type === "error"
        ? "border-red-300 bg-red-50 text-red-950"
        : "border-[#004aad]/30 bg-[#004aad]/8 text-slate-900";
  const Icon = toast.type === "success" ? CheckCircle2 : toast.type === "error" ? AlertCircle : Info;
  const defaultTitle =
    toast.type === "success" ? "Success" : toast.type === "error" ? "Could not submit" : "Working…";
  return (
    <div
      className={`fixed bottom-6 right-6 z-[70] flex max-w-md items-start gap-3 rounded-2xl border-2 px-4 py-3 shadow-xl sm:max-w-lg ${styles}`}
      role="status"
      aria-live={toast.type === "error" ? "assertive" : "polite"}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-90" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-wide opacity-85">{toast.title || defaultTitle}</p>
        <p className="mt-1 text-sm font-semibold leading-snug">{toast.message}</p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold uppercase text-slate-600 hover:bg-black/5"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  required,
  type = "text",
  className = "",
  readOnly = false,
  disabled = false,
}) {
  const locked = disabled || readOnly;
  return (
    <label
      className={`block text-[10px] font-bold uppercase tracking-wider text-slate-600 ${disabled ? "opacity-70" : ""} ${className}`}
    >
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <input
        type={type}
        disabled={disabled}
        readOnly={readOnly && !disabled}
        className={`input-field mt-1 text-sm font-medium text-slate-900 ${
          locked ? "cursor-default border-slate-200/90 bg-slate-50 text-slate-800" : ""
        } ${disabled ? "cursor-not-allowed" : ""}`}
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
 * @param {{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean; placeholder?: string; className?: string; disabled?: boolean }} props
 */
function Select({ label, value, onChange, options, required, placeholder = "Choose…", className = "", disabled = false }) {
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
        disabled={disabled}
        className="input-field mt-1 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
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
 * Standard height: feet + inches dropdowns; stored as `5' 8"`. Unparseable legacy text gets a clear + re-pick path.
 * @param {{ value: string; onChange: (v: string) => void }} props
 */
function HeightFeetInchesFields({ value, onChange }) {
  const parsed = useMemo(() => parseHeightFeetInches(value), [value]);
  const isLegacy = parsed.legacy;

  const handleFeet = (ft) => {
    if (!ft) {
      onChange("");
      return;
    }
    const cur = parseHeightFeetInches(value);
    onChange(formatHeightFeetInches(ft, cur.inches || "0"));
  };

  const handleInches = (inch) => {
    const cur = parseHeightFeetInches(value);
    if (!cur.feet) return;
    onChange(formatHeightFeetInches(cur.feet, inch));
  };

  if (isLegacy) {
    return (
      <div className="sm:col-span-2 space-y-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-950">Height (non-standard format on file)</p>
        <p className="text-sm font-medium text-slate-900">
          <span className="font-mono">{value}</span>
        </p>
        <button
          type="button"
          className="text-xs font-black uppercase tracking-wide text-[#004aad] underline underline-offset-2 hover:text-[#003d8a]"
          onClick={() => onChange("")}
        >
          Clear and choose feet / inches
        </button>
      </div>
    );
  }

  return (
    <>
      <Select
        label="Height — feet"
        value={parsed.feet}
        onChange={handleFeet}
        options={HEIGHT_FEET_OPTIONS}
        placeholder="—"
      />
      <Select
        label="Height — inches"
        value={parsed.inches}
        onChange={handleInches}
        options={HEIGHT_INCHES_OPTIONS}
        placeholder="—"
        disabled={!parsed.feet}
      />
    </>
  );
}

/**
 * City/municipality typeahead within a province — avoids huge &lt;select&gt; lists (fast DOM).
 * @param {{ label: string; required?: boolean; provCode: string; value: string; placeholder: string; disabled?: boolean; phGeo: typeof import("../lib/phPlaceOfBirth.js"); onCommit: (canonicalName: string) => void }} props
 */
function MunicipalityCombobox({ label, required, provCode, value, placeholder, disabled, phGeo, onCommit }) {
  const listId = useId();
  const inputId = useId();
  const ignoreBlurSync = useRef(false);
  const blurTimer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const [text, setText] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setText(value || "");
  }, [value, provCode]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  const suggestions = useMemo(() => {
    if (!phGeo || disabled || !provCode) return [];
    return phGeo.searchMunicipalities(provCode, text, 20);
  }, [phGeo, provCode, text, disabled]);

  useEffect(() => {
    setActiveIdx(0);
  }, [suggestions]);

  const commitMun = (name) => {
    const n = String(name ?? "").trim();
    setText(n);
    onCommit(n);
    setOpen(false);
  };

  const syncFromBlur = () => {
    if (!phGeo || !provCode) return;
    const resolved = phGeo.resolveMunicipalityName(provCode, text);
    if (resolved) {
      if (resolved !== value) onCommit(resolved);
      setText(resolved);
      return;
    }
    if (!String(text ?? "").trim()) {
      if (value) onCommit("");
      setText("");
      return;
    }
    setText(value || "");
  };

  const isLocked = Boolean(disabled);

  return (
    <div className={`relative ${isLocked ? "opacity-70" : ""}`}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600" htmlFor={inputId}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        id={inputId}
        type="text"
        name="placeOfBirthMunCity"
        disabled={isLocked}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && suggestions[activeIdx] ? `${listId}-opt-${activeIdx}` : undefined}
        placeholder={placeholder}
        className="input-field mt-1 w-full text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (!isLocked) setOpen(true);
        }}
        onFocus={() => {
          if (!isLocked) setOpen(true);
        }}
        onBlur={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          blurTimer.current = setTimeout(() => {
            blurTimer.current = null;
            if (ignoreBlurSync.current) {
              ignoreBlurSync.current = false;
              setOpen(false);
              return;
            }
            setOpen(false);
            syncFromBlur();
          }, 120);
        }}
        onKeyDown={(e) => {
          if (isLocked) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setOpen(true);
            setActiveIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(0, i - 1));
            return;
          }
          if (e.key === "Enter") {
            if (open && suggestions.length > 0 && suggestions[activeIdx]) {
              e.preventDefault();
              commitMun(suggestions[activeIdx]);
              return;
            }
            if (phGeo && provCode && String(text ?? "").trim()) {
              const r = phGeo.resolveMunicipalityName(provCode, text);
              if (r) {
                e.preventDefault();
                commitMun(r);
              }
            }
            return;
          }
          if (e.key === "Escape") {
            if (open) {
              e.preventDefault();
              setOpen(false);
            }
          }
        }}
      />
      {open && !isLocked && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-0.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((name, i) => (
            <li key={name} role="presentation">
              <button
                type="button"
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIdx}
                className={`flex w-full px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 ${
                  i === activeIdx ? "bg-slate-100" : ""
                }`}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  ignoreBlurSync.current = true;
                  commitMun(name);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
  /** PMES `Participant` registration fields from GET /pmes/membership-lifecycle (prefill empty form fields). */
  registrationPrefill = null,
  /** Firebase / app display name fallback when `registrationFullName` is missing. */
  authDisplayName = "",
  onSubmitSuccess,
  submitting,
  localError,
}) {
  const [profile, setProfile] = useState(() => createEmptyMemberProfile());
  const [draftSaveBanner, setDraftSaveBanner] = useState(/** @type {null | "restored"} */ (null));
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState(/** @type {number | null} */ (null));
  const [draftImageBackupNote, setDraftImageBackupNote] = useState(false);
  const [formToast, setFormToast] = useState(/** @type {null | { type: "success" | "error" | "info"; title: string; message: string }} */ (null));
  const draftHydratedRef = useRef(false);
  const [sheetFile, setSheetFile] = useState(/** @type {File | null} */ (null));
  const signatureFileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [signaturePadReset, setSignaturePadReset] = useState(0);
  const [signatureImageBusy, setSignatureImageBusy] = useState(false);
  const [signatureImageError, setSignatureImageError] = useState(/** @type {string | null} */ (null));
  const [memberSigPrintedNameError, setMemberSigPrintedNameError] = useState(/** @type {string | null} */ (null));
  const [callsignMsg, setCallsignMsg] = useState(/** @type {string | null} */ (null));
  /** Lazy-loaded PSGC helpers (keeps initial bundle small). */
  const [phGeo, setPhGeo] = useState(
    /** @type {null | typeof import("../lib/phPlaceOfBirth.js")} */ (null),
  );
  const [phGeoLoadFailed, setPhGeoLoadFailed] = useState(false);

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const draftSaveTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  /** Restore saved draft before other effects merge prefills (same browser; keyed by login email). */
  useLayoutEffect(() => {
    const e = String(memberEmail ?? "").trim().toLowerCase();
    if (!e) return;
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    const loaded = loadMemberProfileDraft(e);
    if (!loaded) return;
    setProfile(loaded.profile);
    setDraftSaveBanner("restored");
    setLastDraftSavedAt(loaded.savedAt);
  }, [memberEmail]);

  useEffect(() => {
    let cancelled = false;
    import("../lib/phPlaceOfBirth.js")
      .then((m) => {
        if (!cancelled) setPhGeo(m);
      })
      .catch(() => {
        if (!cancelled) setPhGeoLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          ...(fn && !String(p.personal.firstName ?? "").trim() ? { firstName: fn } : {}),
          ...(mn && !String(p.personal.middleName ?? "").trim() ? { middleName: mn } : {}),
          ...(ln && !String(p.personal.lastName ?? "").trim() ? { lastName: ln } : {}),
        },
        registrationNoExpiry: {
          ...p.registrationNoExpiry,
          ...(tin && !String(p.registrationNoExpiry.tinNo ?? "").trim() ? { tinNo: tin } : {}),
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

  /** Default contact email from the signed-in account when the field is still empty. */
  useEffect(() => {
    const e = String(memberEmail ?? "").trim();
    if (!e) return;
    setProfile((p) => {
      if (String(p.contact.emailAddress ?? "").trim()) return p;
      return { ...p, contact: { ...p.contact, emailAddress: e } };
    });
  }, [memberEmail]);

  /** One-time merge from PostgreSQL registration row + optional Firebase display name. */
  useEffect(() => {
    const rawName =
      String(registrationPrefill?.registrationFullName ?? "").trim() ||
      String(authDisplayName ?? "").trim();
    const dob = String(registrationPrefill?.registrationDob ?? "").trim();
    const genderRaw = String(registrationPrefill?.registrationGender ?? "").trim();
    const phone = String(registrationPrefill?.registrationPhone ?? "").trim();

    if (!rawName && !dob && !genderRaw && !phone) return;

    setProfile((p) => {
      const pr = p.personal;
      const hasSplitName =
        String(pr.firstName || "").trim() !== "" && String(pr.lastName || "").trim() !== "";

      let personal = p.personal;
      let contact = p.contact;
      let changed = false;
      const bump = () => {
        if (!changed) {
          personal = { ...personal };
          contact = { ...contact };
          changed = true;
        }
      };

      if (!hasSplitName && rawName) {
        bump();
        const sp = splitFullNameForPrefill(rawName);
        if (!String(personal.firstName || "").trim()) personal.firstName = sp.firstName;
        if (!String(personal.middleName || "").trim()) personal.middleName = sp.middleName;
        if (!String(personal.lastName || "").trim()) personal.lastName = sp.lastName;
      }

      if (!String(pr.birthDate || "").trim() && dob) {
        bump();
        personal.birthDate = registrationDobToBirthDate(dob);
      }

      const g = mapRegistrationGenderToSexGender(genderRaw);
      if (!String(pr.sexGender || "").trim() && g) {
        bump();
        personal.sexGender = g;
      }

      if (!String(p.contact.mobileNo || "").trim() && phone) {
        bump();
        contact.mobileNo = phone;
      }

      if (!changed) return p;
      return { ...p, personal, contact };
    });
  }, [registrationPrefill, authDisplayName]);

  const phProvinceOptions = useMemo(
    () => (phGeo ? phGeo.getProvinceSelectOptions() : []),
    [phGeo],
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

  /** Autosave draft locally (same device/browser; survives refresh and brief disconnects). */
  useEffect(() => {
    const key = memberProfileDraftKey(memberEmail);
    if (!key || !draftHydratedRef.current) return;

    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      const r = saveMemberProfileDraft(memberEmail, profileRef.current);
      if (r.ok) {
        setLastDraftSavedAt(Date.now());
        if (r.imageStripped) setDraftImageBackupNote(true);
      }
      draftSaveTimerRef.current = null;
    }, 600);

    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [profile, memberEmail]);

  useEffect(() => {
    const e = String(memberEmail ?? "").trim().toLowerCase();
    if (!e) return;
    const flush = () => {
      if (!draftHydratedRef.current) return;
      saveMemberProfileDraft(memberEmail, profileRef.current);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [memberEmail]);

  useEffect(() => {
    if (draftSaveBanner !== "restored") return undefined;
    const t = window.setTimeout(() => setDraftSaveBanner(null), 12000);
    return () => window.clearTimeout(t);
  }, [draftSaveBanner]);

  useEffect(() => {
    if (!formToast) return undefined;
    const ms = formToast.type === "info" ? 30_000 : 14_000;
    const t = window.setTimeout(() => setFormToast(null), ms);
    return () => window.clearTimeout(t);
  }, [formToast]);

  const setAck = (patch) => setProfile((p) => ({ ...p, acknowledgement: { ...p.acknowledgement, ...patch } }));
  const setPersonal = (patch) => setProfile((p) => ({ ...p, personal: { ...p.personal, ...patch } }));

  /** Hydrate PSGC dropdowns from legacy free-text placeOfBirth when codes are empty. */
  useEffect(() => {
    if (!phGeo) return;
    setProfile((p) => {
      const pr = p.personal;
      const hasBoth =
        String(pr.placeOfBirthProvCode ?? "").trim() !== "" &&
        String(pr.placeOfBirthMunCity ?? "").trim() !== "";
      if (hasBoth) return p;
      const parsed = phGeo.parseLegacyPlaceOfBirth(pr.placeOfBirth);
      if (!parsed) return p;
      return {
        ...p,
        personal: {
          ...pr,
          placeOfBirthProvCode: parsed.provCode,
          placeOfBirthMunCity: parsed.munCity,
          placeOfBirth: phGeo.formatPlaceOfBirth(parsed.provCode, parsed.munCity),
        },
      };
    });
  }, [profile.personal.placeOfBirth, phGeo]);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
      setFormToast({
        type: "error",
        title: "Consent required",
        message: "Please check the data processing consent box (Acknowledgement section at the top), then submit again.",
      });
      return;
    }
    if (phGeoLoadFailed) {
      setFormToast({
        type: "error",
        title: "Address data unavailable",
        message: "Location helpers failed to load. Refresh the page and try again.",
      });
      return;
    }
    if (!phGeo) {
      setFormToast({
        type: "info",
        title: "Almost ready",
        message: "Loading address data… wait a moment, then try Submit again.",
      });
      return;
    }
    const printed = getSignaturePrintedName(profile);
    if (!printed) {
      setMemberSigPrintedNameError("Enter your full name as it should appear as signature over printed name.");
      setFormToast({
        type: "error",
        title: "Signature name required",
        message: "Enter your full name in “Signature over printed name” (Acknowledgement or Member signature section), then submit again.",
      });
      return;
    }
    setMemberSigPrintedNameError(null);

    const merged = {
      ...profile,
      acknowledgement: {
        ...profile.acknowledgement,
        memberSignatureOverPrintedName: printed,
      },
      signature: {
        ...profile.signature,
        memberSignatureOverPrintedName: printed,
      },
      cooperative: {
        ...profile.cooperative,
        address: OFFICIAL_COOPERATIVE_ADDRESS,
        emailAddress: OFFICIAL_COOPERATIVE_EMAIL,
      },
      contact: { ...profile.contact, emailAddress: profile.contact.emailAddress || memberEmail || "" },
    };

    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), SUBMIT_TIMEOUT_MS);
    setFormToast({
      type: "info",
      title: "Submitting…",
      message: "Sending your membership form to the server. Please keep this page open.",
    });

    try {
      await onSubmitSuccess({
        profileJson: JSON.stringify(merged),
        sheetFileName: sheetFile ? sheetFile.name : "",
        notes: profile.internalNotes || "",
        abortSignal: ctrl.signal,
      });
      window.clearTimeout(tid);
      setFormToast({
        type: "success",
        title: "Form received",
        message:
          "Your membership form was submitted successfully. Next you’ll see your Member ID and login confirmation, then you can open the member portal.",
      });
      clearMemberProfileDraft(String(memberEmail ?? "").trim());
      setDraftSaveBanner(null);
      setLastDraftSavedAt(null);
      setDraftImageBackupNote(false);
    } catch (err) {
      window.clearTimeout(tid);
      setFormToast({
        type: "error",
        title: "Submission failed",
        message: formatSubmitError(err),
      });
    }
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-busy={submitting}
      noValidate
    >
      <p className="text-sm font-medium leading-relaxed text-slate-600">
        Complete all sections that apply. Fields marked <span className="text-red-600">*</span> match the paper form. Board
        approval checkboxes are recorded by staff; you may leave resolution references blank unless instructed.
      </p>

      <div className="space-y-2">
        <p className="rounded-2xl border border-[#004aad]/25 bg-[#004aad]/5 px-4 py-3 text-sm font-medium leading-relaxed text-slate-800">
          Your answers are saved automatically in this browser while you work. You can close the tab, refresh, or lose
          connection briefly and pick up where you left off on this device. Submitting the form clears this saved draft.
        </p>
        {draftSaveBanner === "restored" ? (
          <p
            className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-emerald-950"
            role="status"
          >
            Restored your saved progress from this browser.
          </p>
        ) : null}
        {lastDraftSavedAt ? (
          <p className="text-xs font-medium text-slate-500" aria-live="polite">
            Draft saved locally at {new Date(lastDraftSavedAt).toLocaleString()}.
          </p>
        ) : null}
        {draftImageBackupNote ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
            Browser storage was almost full, so your uploaded signature image was not kept in the automatic backup. Your
            other fields are saved; add the signature again before submitting if needed.
          </p>
        ) : null}
      </div>

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
          />
          <span className="text-sm font-medium leading-relaxed text-slate-700">
            I acknowledge consent to the collection, use, processing, storage, and disposal of my personal identifiable
            information for cooperative products and services and legitimate business purposes, including compliance with RA
            9520, RA 9510, and RA 9160.
          </span>
        </label>
        <Text
          label="Signature over printed name (type your full name)"
          value={getSignaturePrintedName(profile)}
          onChange={(v) => {
            setAck({ memberSignatureOverPrintedName: v });
            setSig({ memberSignatureOverPrintedName: v });
          }}
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
          <Text
            label="Email address"
            type="email"
            value={ct.emailAddress}
            onChange={(v) => setContact({ emailAddress: v })}
            required
          />
          <p className="text-xs font-medium leading-snug text-slate-500">
            Cooperative notices and account recovery use this address. It defaults to your sign-in email; change it here if you
            prefer a different one.
          </p>
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
        {phGeoLoadFailed ? (
          <p className="text-sm font-medium text-red-700 sm:col-span-2">
            Place-of-birth lists could not be loaded. Check your connection and refresh the page.
          </p>
        ) : !phGeo ? (
          <div className="flex items-center gap-2 py-2 sm:col-span-2">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#004aad]" aria-hidden />
            <span className="text-sm font-medium text-slate-600">Loading Philippine place-of-birth lists…</span>
          </div>
        ) : (
          <>
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
            <MunicipalityCombobox
              label="City / municipality"
              required
              provCode={pr.placeOfBirthProvCode}
              value={pr.placeOfBirthMunCity}
              disabled={!pr.placeOfBirthProvCode}
              placeholder={pr.placeOfBirthProvCode ? "Type to search (e.g. Cala…)" : "Select province first"}
              phGeo={phGeo}
              onCommit={(mun) =>
                setPersonal({
                  placeOfBirthMunCity: mun,
                  placeOfBirth: phGeo.formatPlaceOfBirth(pr.placeOfBirthProvCode, mun),
                })
              }
            />
          </>
        )}
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
        <HeightFeetInchesFields
          value={pr.heightFeetInches}
          onChange={(v) => setPersonal({ heightFeetInches: v })}
        />
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
        <div className="sm:col-span-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#004aad]">Mother&apos;s current address</p>
          <p className="text-sm font-medium leading-relaxed text-slate-700">
            Region, province, city/municipality, barangay, street, and postal code below refer to where she{" "}
            <span className="font-bold text-slate-900">currently</span> resides (or last known address if that applies).
          </p>
          <label className="flex cursor-pointer items-start gap-3 text-sm font-bold text-slate-900">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#004aad] focus:ring-[#004aad]"
              checked={Boolean(mo.deceased)}
              onChange={(e) => setMother({ deceased: e.target.checked })}
            />
            <span>
              Deceased <span className="font-medium text-slate-600">(address not applicable — fields below are disabled)</span>
            </span>
          </label>
        </div>
        <Select
          label="Region"
          value={mo.region}
          onChange={(v) => setMother({ region: v })}
          options={PH_REGION_OPTIONS}
          required={!mo.deceased}
          placeholder="Select region"
          disabled={Boolean(mo.deceased)}
        />
        <Text
          label="Province"
          value={mo.province}
          onChange={(v) => setMother({ province: v })}
          required={!mo.deceased}
          disabled={Boolean(mo.deceased)}
        />
        <Text
          label="City / Municipality"
          value={mo.cityMunicipality}
          onChange={(v) => setMother({ cityMunicipality: v })}
          required={!mo.deceased}
          disabled={Boolean(mo.deceased)}
        />
        <Text label="Barangay" value={mo.barangay} onChange={(v) => setMother({ barangay: v })} disabled={Boolean(mo.deceased)} />
        <Text
          label="No. / Street / Subdivision"
          value={mo.streetSubdivision}
          onChange={(v) => setMother({ streetSubdivision: v })}
          disabled={Boolean(mo.deceased)}
        />
        <Text label="Postal code" value={mo.postalCode} onChange={(v) => setMother({ postalCode: v })} disabled={Boolean(mo.deceased)} />
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
        <div className="sm:col-span-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#004aad]">Father&apos;s current address</p>
          <p className="text-sm font-medium leading-relaxed text-slate-700">
            Region, province, city/municipality, barangay, street, and postal code below refer to where he{" "}
            <span className="font-bold text-slate-900">currently</span> resides (or last known address if that applies).
          </p>
          <label className="flex cursor-pointer items-start gap-3 text-sm font-bold text-slate-900">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#004aad] focus:ring-[#004aad]"
              checked={Boolean(fa.deceased)}
              onChange={(e) => setFather({ deceased: e.target.checked })}
            />
            <span>
              Deceased <span className="font-medium text-slate-600">(address not applicable — fields below are disabled)</span>
            </span>
          </label>
        </div>
        <Select
          label="Region"
          value={fa.region}
          onChange={(v) => setFather({ region: v })}
          options={PH_REGION_OPTIONS}
          placeholder="Select region"
          disabled={Boolean(fa.deceased)}
        />
        <Text label="Province" value={fa.province} onChange={(v) => setFather({ province: v })} disabled={Boolean(fa.deceased)} />
        <Text
          label="City / Municipality"
          value={fa.cityMunicipality}
          onChange={(v) => setFather({ cityMunicipality: v })}
          disabled={Boolean(fa.deceased)}
        />
        <Text label="Barangay" value={fa.barangay} onChange={(v) => setFather({ barangay: v })} disabled={Boolean(fa.deceased)} />
        <Text
          label="No. / Street / Subdivision"
          value={fa.streetSubdivision}
          onChange={(v) => setFather({ streetSubdivision: v })}
          disabled={Boolean(fa.deceased)}
        />
        <Text label="Postal code" value={fa.postalCode} onChange={(v) => setFather({ postalCode: v })} disabled={Boolean(fa.deceased)} />
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
          value={getSignaturePrintedName(profile)}
          onChange={(v) => {
            setAck({ memberSignatureOverPrintedName: v });
            setSig({ memberSignatureOverPrintedName: v });
            setMemberSigPrintedNameError(null);
          }}
          required
        />
        <Text label="Date" value={sg.date} onChange={(v) => setSig({ date: v })} />
        {memberSigPrintedNameError ? (
          <p className="sm:col-span-2 text-xs font-semibold text-red-600" role="alert">
            {memberSigPrintedNameError}
          </p>
        ) : null}
        <p className="sm:col-span-2 text-xs font-medium leading-relaxed text-slate-600">
          By submitting this form, your printed name above and any signature image you add below (drawn or uploaded) serve as
          your electronic signature on this membership application.
        </p>
        <div className="sm:col-span-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <SignatureDrawPad
            disabled={submitting || signatureImageBusy}
            resetVersion={signaturePadReset}
            onApply={(dataUrl) => {
              setSignatureImageError(null);
              setSig({ memberSignatureImageDataUrl: dataUrl });
            }}
          />
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Or upload a photo <span className="font-medium normal-case text-slate-500">(scan or photo of your ink signature)</span>
            </p>
          <div className="flex flex-wrap items-start gap-3">
            <input
              ref={signatureFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              className="sr-only"
              id="member-signature-image-input"
              disabled={signatureImageBusy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setSignatureImageError(null);
                setSignatureImageBusy(true);
                try {
                  const dataUrl = await compressImageFileToJpegDataUrl(file);
                  setSig({ memberSignatureImageDataUrl: dataUrl });
                  setSignaturePadReset((n) => n + 1);
                } catch (err) {
                  setSignatureImageError(err instanceof Error ? err.message : "Could not use that image.");
                } finally {
                  setSignatureImageBusy(false);
                }
              }}
            />
            <label
              htmlFor="member-signature-image-input"
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#004aad]/40 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#004aad] shadow-sm hover:bg-[#004aad]/5 ${
                signatureImageBusy ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {signatureImageBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              Upload image
            </label>
            {sg.memberSignatureImageDataUrl ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setSig({ memberSignatureImageDataUrl: "" });
                  setSignatureImageError(null);
                  setSignaturePadReset((n) => n + 1);
                }}
              >
                <X className="h-4 w-4" aria-hidden />
                Remove
              </button>
            ) : null}
          </div>
          {signatureImageError ? (
            <p className="text-xs font-semibold text-red-600" role="alert">
              {signatureImageError}
            </p>
          ) : null}
          {sg.memberSignatureImageDataUrl ? (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Signature image preview</p>
              <img
                src={sg.memberSignatureImageDataUrl}
                alt="Signature image attached to this application"
                className="max-h-28 max-w-full object-contain object-left"
              />
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500">
              Drawing and upload are optional; your printed name is required. Use one or both if you want an image on file.
            </p>
          )}
          </div>
        </div>
        <TextArea
          label="Notes for membership desk"
          value={profile.internalNotes}
          onChange={(v) => setProfile((p) => ({ ...p, internalNotes: v }))}
          rows={3}
        />
      </Section>

      <div className="space-y-2 sm:col-span-2">
        <p className="text-xs font-medium text-slate-500">
          {submitting
            ? "Submitting — please keep this tab open."
            : !profile.acknowledgement.consentToDataProcessing
              ? "Check the data-processing consent box (Acknowledgement section) before submitting."
              : phGeoLoadFailed
                ? "Place-of-birth data failed to load — refresh the page, then try Submit again."
                : !phGeo
                  ? "Wait for place-of-birth lists to finish loading, then tap Submit."
                  : !getSignaturePrintedName(profile)
                    ? "Enter your full name in “Signature over printed name” (top or bottom of the form), then submit."
                    : "Ready to submit when your entries are complete."}
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary flex w-full items-center justify-center gap-2 py-4 sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Lock className="h-5 w-5" aria-hidden />}
          {submitting ? "Submitting…" : "Submit membership form"}
        </button>
      </div>

      <FormToast toast={formToast} onDismiss={() => setFormToast(null)} />
    </form>
  );
}
