export type SearchValues = Record<string, string | string[] | undefined>;
export type ProjectQuery = {
  state?: "active" | "funded" | "expired" | "closed" | "upcoming" | "reserved" | "unavailable" | "all";
  page: number;
  country_code?: string;
  donation_project_category_id?: string;
  sort: "created_at" | "acceptance_ends_at" | "target_amount_minor";
};

// ISO alpha-2 reference data matched to Laravel's installed league/iso3166 registry.
// This is not a catalog of countries with published projects. Snapshot: 2026-10-20.
const countryCodes = "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE ET SZ FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MK MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ");
const countrySet = new Set(countryCodes);
export function countryName(code: string) {
  return new Intl.DisplayNames("ar", { type: "region" }).of(code) || code;
}
export function countryOptions() {
  return countryCodes.map(code => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}
const single = (value: string | string[] | undefined) => typeof value === "string" ? value.trim() : "";
function positiveId(value: string) {
  if (!/^\d{1,19}$/.test(value)) return undefined;
  const n = BigInt(value);
  return n > BigInt(0) && n <= BigInt("9223372036854775807") ? n.toString() : undefined;
}
export function parseProjectQuery(values: SearchValues): ProjectQuery {
  const page = single(values.page);
  const country = single(values.country_code).toUpperCase();
  const sort = single(values.sort);
  const state = single(values.state);
  return {
    ...(["funded", "expired", "closed", "upcoming", "reserved", "unavailable", "all"].includes(state) ? { state: state as ProjectQuery["state"] } : {}),
    page: /^\d{1,10}$/.test(page) && Number(page) > 0 && Number(page) <= 2147483647 ? Number(page) : 1,
    country_code: countrySet.has(country) ? country : undefined,
    donation_project_category_id: positiveId(single(values.donation_project_category_id)),
    sort: sort === "acceptance_ends_at" || sort === "target_amount_minor" ? sort : "created_at",
  };
}
export function projectParams(query: ProjectQuery) {
  const params = new URLSearchParams();
  if (query.state && query.state !== "active") params.set("state", query.state);
  if (query.country_code) params.set("country_code", query.country_code);
  if (query.donation_project_category_id) params.set("donation_project_category_id", query.donation_project_category_id);
  if (query.sort !== "created_at") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}
export function projectHref(query: ProjectQuery) {
  const params = projectParams(query).toString();
  return `/projects${params ? `?${params}` : ""}`;
}
export function changeProjectFilters(query: ProjectQuery, changes: Partial<Omit<ProjectQuery, "page">>) {
  return { ...query, ...changes, page: 1 };
}
export function searchValues(params: URLSearchParams): SearchValues {
  const values: SearchValues = Object.create(null);
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    values[key] = all.length === 1 ? all[0] : all;
  }
  return values;
}
export function needsNormalization(values: SearchValues, query: ProjectQuery) {
  const normalized = projectParams(query);
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return entries.length !== normalized.size || entries.some(([key, value]) => normalized.get(key) !== value);
}
export function backendProjectParams(query: ProjectQuery, perPage: number) {
  const normalized = parseProjectQuery({ ...Object.fromEntries(projectParams(query)), page: String(query.page) });
  const params = projectParams(normalized);
  params.set("page", String(normalized.page));
  params.set("per_page", String(Number.isSafeInteger(perPage) ? Math.min(100, Math.max(1, perPage)) : 12));
  return params;
}
