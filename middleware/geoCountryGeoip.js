const geoip = require("geoip-lite");

const EU = new Set([
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

// Common EU languages: use as a heuristic when no country is present
const EU_LANGS = new Set([
  "de",
  "fr",
  "it",
  "es",
  "nl",
  "pl",
  "sv",
  "da",
  "fi",
  "cs",
  "sk",
  "sl",
  "hr",
  "hu",
  "ro",
  "bg",
  "el",
  "pt",
  "et",
  "lv",
  "lt",
  "ga",
  "mt",
]);

function resolveRegionFromCountry(cc = "") {
  const c = String(cc || "").toUpperCase();
  if (c === "IN") return "IN";
  if (EU.has(c)) return "EU";
  return "INTL";
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const ip = xff.split(",")[0].trim();
    if (ip) return ip;
  }
  return req.ip || req.connection?.remoteAddress || "";
}

// Parse full Accept-Language list, in order, with q-values
function parseAcceptLanguageList(header = "") {
  // e.g. "en-GB,en-US;q=0.9,en;q=0.8,de;q=0.7"
  return header
    .split(",")
    .map((part) => {
      const [tag, qpart] = part.trim().split(";"); // "en-GB", "q=0.9"
      const m = /^([a-z]{2})(?:-([A-Z]{2}))?$/i.exec(tag || "");
      if (!m) return null;
      const lang = m[1]?.toLowerCase() || null;
      const country = m[2]?.toUpperCase() || null;
      const q = qpart?.startsWith("q=") ? parseFloat(qpart.slice(2)) : 1;
      return { lang, country, q };
    })
    .filter(Boolean)
    .sort((a, b) => b.q - a.q); // best first
}

function geoCountryGeoip(req, _res, next) {
  // Dev override: /?country=DE
  if (req.query.country) {
    const cc = String(req.query.country).toUpperCase();
    req.geo = { countryCode: cc, region: resolveRegionFromCountry(cc) };
    return next();
  }

  // Provider/CDN headers (add more if you use a different edge)
  const headerCountry =
    req.headers["cf-ipcountry"] ||
    req.headers["x-vercel-ip-country"] ||
    req.headers["x-country-code"] ||
    req.headers["x-geo-country"] ||
    null;

  if (headerCountry) {
    const cc = String(headerCountry).toUpperCase();
    req.geo = { countryCode: cc, region: resolveRegionFromCountry(cc) };
    return next();
  }

  // GeoIP by IP
  const ip = getClientIp(req);
  let cc = geoip.lookup(ip)?.country || null;

  // Accept-Language fallback — scan full list for the best EU hint
  if (!cc) {
    const list = parseAcceptLanguageList(req.headers["accept-language"] || "");

    // 1) Prefer any entry that has an explicit **EU country**
    const withEuCountry = list.find((e) => e.country && EU.has(e.country));
    if (withEuCountry) cc = withEuCountry.country;

    // 2) Otherwise, if any entry uses a known EU language, treat as EU (pick DE as canonical)
    if (!cc) {
      const withEuLang = list.find((e) => e.lang && EU_LANGS.has(e.lang));
      if (withEuLang) cc = "DE";
    }

    // 3) Finally, if the TOP entry has a country, use it (even if non-EU)
    if (!cc && list[0]?.country) cc = list[0].country;
  }

  if (!cc) cc = "INTL";

  req.geo = { countryCode: cc, region: resolveRegionFromCountry(cc) };
  next();
}

module.exports = { geoCountryGeoip, resolveRegionFromCountry };
