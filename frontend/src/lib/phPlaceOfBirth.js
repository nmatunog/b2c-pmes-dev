/**
 * Philippine province → city/municipality options for "place of birth" (PSGC-based).
 * Data: @jobuntux/psgc (PSA PSGC release bundled as JSON).
 */
import rawProvinces from "@jobuntux/psgc/data/2025-2Q/provinces.json";
import rawMuncities from "@jobuntux/psgc/data/2025-2Q/muncities.json";

/** @typedef {{ provCode?: string, provName: string }} TProv */
/** @typedef {{ provCode: string, munCityName: string }} TMun */

const provinces = /** @type {TProv[]} */ (rawProvinces);
const muncities = /** @type {TMun[]} */ (rawMuncities);

const provinceByCode = new Map();
for (const p of provinces) {
  if (p.provCode) provinceByCode.set(p.provCode, p);
}

const munByProvCode = muncities.reduce((acc, m) => {
  const k = m.provCode;
  if (!acc[k]) acc[k] = [];
  acc[k].push(m);
  return acc;
}, /** @type {Record<string, TMun[]>} */ ({}));

export function normalizeGeoName(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @returns {{ value: string; label: string }[]} */
export function getProvinceSelectOptions() {
  return provinces
    .filter((p) => p.provCode)
    .map((p) => ({
      value: p.provCode,
      label: normalizeGeoName(p.provName),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
}

/** @returns {{ value: string; label: string }[]} */
export function getMunicipalitySelectOptions(provCode) {
  if (!provCode) return [];
  const list = munByProvCode[provCode];
  if (!list?.length) return [];
  return list
    .map((m) => {
      const label = normalizeGeoName(m.munCityName);
      return { value: label, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
}

/** @param {string} provCode */
export function formatPlaceOfBirth(provCode, munCityName) {
  const c = normalizeGeoName(munCityName);
  const p = provCode ? provinceByCode.get(provCode) : undefined;
  const pname = p ? normalizeGeoName(p.provName) : "";
  if (!c || !pname) return "";
  return `${c}, ${pname}`;
}

/**
 * Best-effort parse of legacy free-text "City/Municipality, Province" into PSGC codes.
 * @returns {{ provCode: string; munCity: string } | null}
 */
export function parseLegacyPlaceOfBirth(placeOfBirthStr) {
  const raw = String(placeOfBirthStr ?? "").trim();
  if (!raw) return null;

  const byName = new Map();
  for (const p of provinces) {
    if (!p.provCode) continue;
    byName.set(normalizeGeoName(p.provName).toLowerCase(), p);
  }

  const lastComma = raw.lastIndexOf(",");
  if (lastComma <= 0) return null;

  const cityPart = normalizeGeoName(raw.slice(0, lastComma));
  const provPart = normalizeGeoName(raw.slice(lastComma + 1));
  const prov = byName.get(provPart.toLowerCase());
  if (!prov?.provCode) return null;

  const muns = munByProvCode[prov.provCode] ?? [];
  const cityNorm = cityPart.toLowerCase();
  const match = muns.find((m) => normalizeGeoName(m.munCityName).toLowerCase() === cityNorm);
  if (match) {
    return { provCode: prov.provCode, munCity: normalizeGeoName(match.munCityName) };
  }
  return { provCode: prov.provCode, munCity: cityPart };
}
