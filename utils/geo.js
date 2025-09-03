// apis/utils/geo.js
// Returns uppercased 2-letter country code, best-effort
const EU_SET = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

function resolveRegionFromCountry(countryCode = "") {
  const cc = String(countryCode || "").toUpperCase();
  if (cc === "IN") return "IN";
  if (EU_SET.has(cc)) return "EU";
  return "INTL";
}

function getCountryCodeFromReq(req) {
  // 1) explicit override (great for testing): ?country=DE
  if (req.query.country) return String(req.query.country).toUpperCase();
  if (req.body?.countryCode) return String(req.body.countryCode).toUpperCase();

  // 2) logged-in user’s saved address (if present)
  const addrCC = req.user?.address?.country;
  if (addrCC) return String(addrCC).toUpperCase();

  // 3) Cloudflare (recommended if you use CF): cf-ipcountry
  // (Enable Cloudflare proxy on your domain; they inject this header)
  const cf = req.headers["cf-ipcountry"];
  if (cf) return String(cf).toUpperCase();

  // 4) Fastly/Akamai/Custom edge may set x-country-code
  const edgeCC = req.headers["x-country-code"];
  if (edgeCC) return String(edgeCC).toUpperCase();

  // 5) Quick guess from Accept-Language
  const al = req.headers["accept-language"] || "";
  // e.g. "de-DE,de;q=0.9,en;q=0.8"
  const m = al.match(/[a-z]{2}-([A-Z]{2})/);
  if (m) return m[1];

  // 6) default fallback
  return "INTL";
}

module.exports = { getCountryCodeFromReq, resolveRegionFromCountry };
