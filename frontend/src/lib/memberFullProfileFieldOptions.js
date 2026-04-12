/**
 * Standardized choices for the digital membership form (aligned for reporting; free text still allowed via “Other”).
 */

/** @typedef {{ value: string; label: string }} FieldOption */

/** @param {string[]} values */
function asOptions(values) {
  return values.map((value) => ({ value, label: value }));
}

export const CIVIL_STATUS_OPTIONS = asOptions([
  "Single",
  "Married",
  "Widowed",
  "Divorced",
  "Legally separated",
  "Annulled",
]);

export const SEX_GENDER_OPTIONS = asOptions([
  "Female",
  "Male",
  "Non-binary",
  "Prefer not to say",
]);

export const BLOOD_TYPE_OPTIONS = asOptions(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"]);

export const NAME_SUFFIX_OPTIONS = [{ value: "", label: "None" }, ...asOptions(["Jr.", "Sr.", "II", "III", "IV", "V"])];

export const COUNTRY_OPTIONS = asOptions([
  "Philippines",
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Japan",
  "China",
  "South Korea",
  "Singapore",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Other (specify in notes or contact field)",
]);

export const CITIZENSHIP_OPTIONS = asOptions([
  "Filipino",
  "Dual (Filipino + other)",
  "American",
  "Other (specify in notes)",
]);

export const RELIGION_OPTIONS = asOptions([
  "Roman Catholic",
  "Iglesia ni Cristo",
  "Islam",
  "Evangelical / Born Again",
  "Protestant (other)",
  "Seventh-day Adventist",
  "Buddhist",
  "Hindu",
  "Jehovah's Witnesses",
  "Church of Jesus Christ of Latter-day Saints",
  "Aglipayan / IFI",
  "None",
  "Prefer not to say",
  "Other (specify in notes)",
]);

export const HIGHEST_EDUCATION_OPTIONS = asOptions([
  "Elementary",
  "High school",
  "Senior high school",
  "Technical / vocational",
  "Associate degree",
  "Bachelor's degree",
  "Master's degree",
  "Doctorate / professional",
  "Other (specify in notes)",
]);

/** Philippine regions (common government / CDA-style wording). */
export const PH_REGION_OPTIONS = asOptions([
  "National Capital Region (NCR)",
  "Region I — Ilocos Region",
  "Region II — Cagayan Valley",
  "Region III — Central Luzon",
  "Region IV-A — CALABARZON",
  "Region IV-B — MIMAROPA",
  "Region V — Bicol",
  "Region VI — Western Visayas",
  "Region VII — Central Visayas",
  "Region VIII — Eastern Visayas",
  "Region IX — Zamboanga Peninsula",
  "Region X — Northern Mindanao",
  "Region XI — Davao Region",
  "Region XII — SOCCSKSARGEN",
  "Region XIII — Caraga",
  "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)",
  "Cordillera Administrative Region (CAR)",
]);

export const YES_NO_OPTIONS = asOptions(["Yes", "No"]);

export const YES_NO_NA_OPTIONS = asOptions(["Yes", "No", "Not applicable"]);

export const EMPLOYMENT_STATUS_OPTIONS = asOptions([
  "Employed — private sector",
  "Employed — government",
  "Self-employed",
  "Business owner",
  "Overseas Filipino Worker (OFW)",
  "Unemployed",
  "Student",
  "Retired",
  "Homemaker",
  "Not applicable",
]);

export const JOB_LEVEL_OPTIONS = asOptions([
  "Entry / staff",
  "Supervisory",
  "Managerial",
  "Executive",
  "Owner / proprietor",
  "Not applicable",
]);

export const EMPLOYMENT_SECTOR_OPTIONS = asOptions([
  "Agriculture, forestry, fishing",
  "Mining / quarrying",
  "Manufacturing",
  "Construction",
  "Wholesale / retail trade",
  "Transportation / storage",
  "Accommodation / food services",
  "Information / communication",
  "Finance / insurance",
  "Real estate",
  "Professional / scientific / technical",
  "Administrative / support",
  "Public administration / defense",
  "Education",
  "Human health / social work",
  "Arts / entertainment",
  "Other services",
  "Not applicable",
]);

export const SELF_EMPLOYMENT_SECTOR_OPTIONS = EMPLOYMENT_SECTOR_OPTIONS;

export const BANK_ACCOUNT_TYPE_OPTIONS = asOptions([
  "Savings",
  "Current / checking",
  "Time deposit",
  "Joint account",
  "Other (specify with bank)",
]);

export const SENIOR_CITIZEN_OPTIONS = asOptions(["Yes", "No", "Not applicable"]);

export const CHILD_DEPENDENT_COUNT_OPTIONS = asOptions([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10+",
]);
