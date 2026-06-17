const STORAGE_KEY = "bdgt.transactions.v1";
const RULES_KEY = "bdgt.rules.v1";
const OVERRIDES_KEY = "bdgt.overrides.v1";
const ARCHIVED_RECURRING_KEY = "bdgt.archivedRecurring.v1";
const RECURRING_STREAMS_KEY = "bdgt.recurringStreams.v1";
const PROJECTS_KEY = "bdgt.projects.v1";
const NET_WORTH_KEY = "bdgt.networth.v1";
const SECTION_KEY = "bdgt.section.active";
const BACKUP_PREFIX = "bdgt.";
const BACKUP_VERSION = 2;
const BACKUP_FILE_NAME = "bdgt-backup.json";
const AMAZON_DESCRIPTION_PREFIX = "Amazon:";
const AMAZON_MERCHANT_KEYWORDS = ["amazon", "amzn"];

const DEFAULT_CATEGORIES = [
  "Income",
  "House",
  "Travel",
  "Cars",
  "Kids",
  "Essential",
  "Self-improvement",
  "Discretionary"
];

const DEFAULT_RETIREMENT_EXPENSE_CATEGORIES = DEFAULT_CATEGORIES
  .filter((category) => category !== "Income");

const RETIREMENT_EXPENSE_METHODS = ["average", "median", "trimmed", "custom"];
const FORECAST_NET_WORTH_METHODS = ["cagr", "linear"];

const defaultRules = {
  monthsToShow: 6,
  exclusionThreshold: 20000,
  exclusionRules: [],
  exclusionAllowlist: [],
  expenseCategoryRules: [],
  incomeCategoryRules: [],
  proposalMin: 2,
  categoryTrendMax: 5000,
  forecastInflowGrowth: 2,
  forecastOutflowGrowth: 2,
  forecastBaseInflow: null,
  forecastBaseOutflow: null,
  forecastStartBalance: null,
  forecastUseNetWorth: true,
  forecastNetWorthLookback: 24,
  forecastNetWorthMethod: "cagr",
  forecastNetWorthGrowth: null,
  forecastNetWorthContribution: 0,
  forecastNetWorthSplits: [],
  retirementCurrentAge: null,
  retirementAge: 67,
  retirementExistingEP: null,
  retirementAnnualGross: null,
  retirementUseInflowProxy: true,
  retirementGrossFactor: 1,
  retirementSex: "other",
  retirementLifeExpectancy: null,
  retirementUseLifeExpectancy: true,
  retirementInvestedShare: 60,
  retirementMarketGrowth: 6,
  retirementExpenseMonths: 12,
  retirementExpenseMethod: "average",
  retirementExpenseCustom: null,
  retirementExpenseCategories: DEFAULT_RETIREMENT_EXPENSE_CATEGORIES.slice()
};

const DEFAULT_RULE_SEEDS = {
  expense: [
    { keyword: "rent", category: "House" },
    { keyword: "mortgage", category: "House" },
    { keyword: "flight", category: "Travel" },
    { keyword: "hotel", category: "Travel" },
    { keyword: "fuel", category: "Cars" },
    { keyword: "parking", category: "Cars" },
    { keyword: "daycare", category: "Kids" },
    { keyword: "school", category: "Kids" },
    { keyword: "grocery", category: "Essential" },
    { keyword: "insurance", category: "Essential" },
    { keyword: "gym", category: "Self-improvement" },
    { keyword: "course", category: "Self-improvement" },
    { keyword: "restaurant", category: "Discretionary" },
    { keyword: "coffee", category: "Discretionary" }
  ],
  income: [
    { keyword: "salary", category: "Income" },
    { keyword: "payroll", category: "Income" },
    { keyword: "bonus", category: "Income" }
  ]
};


const state = {
  transactions: [],
  rules: { ...defaultRules },
  overrides: {},
  overrideTargetKey: null,
  archivedRecurring: {},
  recurringStreams: [],
  recurringEditingId: null,
  projects: [],
  projectEditingId: null,
  netWorth: null,
  charts: {},
  view: {
    derived: [],
    analyzed: []
  },
  filters: {
    search: "",
    flow: "all",
    category: "all",
    tag: "all",
    minAmount: "",
    maxAmount: "",
    month: "all",
    showExcluded: true
  }
};

function destroyCharts() {
  Object.values(state.charts || {}).forEach((chart) => {
    if (chart && typeof chart.destroy === "function") {
      chart.destroy();
    }
  });
  state.charts = {};
}

function resetStateToDefaults() {
  destroyCharts();
  state.transactions = [];
  state.rules = { ...defaultRules };
  state.overrides = {};
  state.overrideTargetKey = null;
  state.archivedRecurring = {};
  state.recurringStreams = [];
  state.recurringEditingId = null;
  state.projects = [];
  state.projectEditingId = null;
  state.netWorth = { sources: [], records: [] };
  state.view = { derived: [], analyzed: [] };
  state.filters = {
    search: "",
    flow: "all",
    category: "all",
    tag: "all",
    minAmount: "",
    maxAmount: "",
    month: "all",
    showExcluded: true
  };
}

const el = (id) => document.getElementById(id);
const emptyState = (message) => `<div class="alert alert-light border mb-0">${message}</div>`;
const TX_TABLE_HEADERS = ["Date", "Payee", "Purpose", "Category", "Tags", "Kind", "Recurring", "Amount"];
const TX_TAG_FILTER_OPTIONS = [
  { value: "all", label: "All tags" },
  { value: "default", label: "Default" },
  { value: "rule", label: "Auto" },
  { value: "manual", label: "Manual" }
];

function buildTable(headers, rowsHtml, options = {}) {
  const { tableClass = "", responsive = true } = options;
  const headerHtml = headers.map((header) => `<th>${header}</th>`).join("");
  const tableHtml = `
    <table class="table table-sm table-striped align-middle mb-0${tableClass ? ` ${tableClass}` : ""}">
      <thead>
        <tr>
          ${headerHtml}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
  return responsive ? `<div class="table-responsive">${tableHtml}</div>` : tableHtml;
}

function isDefaultCategory(value) {
  return DEFAULT_CATEGORIES.includes(value);
}

function sanitizeCategory(value) {
  const trimmed = (value || "").trim();
  return isDefaultCategory(trimmed) ? trimmed : "";
}

function populateCategorySelect(select) {
  if (!select) return;
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select category";
  select.appendChild(placeholder);
  DEFAULT_CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}

function categoryOptionsHtml(selected) {
  const normalized = sanitizeCategory(selected);
  const options = ['<option value="">Select category</option>'];
  DEFAULT_CATEGORIES.forEach((category) => {
    const safeValue = escapeHtml(category);
    const isSelected = category === normalized ? " selected" : "";
    options.push(`<option value="${safeValue}"${isSelected}>${safeValue}</option>`);
  });
  return options.join("");
}

function populateCategorySelects() {
  populateCategorySelect(el("expenseRuleCategory"));
  populateCategorySelect(el("incomeRuleCategory"));
  populateCategorySelect(el("overrideCategory"));
}

function populateCategoryFilter() {
  const select = el("txCategory");
  if (!select) return;
  const previous = select.value;
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All categories";
  select.appendChild(allOption);
  DEFAULT_CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  if (previous && Array.from(select.options).some((opt) => opt.value === previous)) {
    select.value = previous;
  } else {
    select.value = "all";
  }
}

function populateTagFilter() {
  const select = el("txTag");
  if (!select) return;
  const previous = select.value;
  select.innerHTML = "";
  TX_TAG_FILTER_OPTIONS.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    select.appendChild(option);
  });
  if (previous && Array.from(select.options).some((opt) => opt.value === previous)) {
    select.value = previous;
  } else {
    select.value = "all";
  }
}

function detectCsvDelimiter(text) {
  const lines = (text || "").split(/\r?\n/);
  let best = ",";
  let bestCount = 0;

  for (let i = 0; i < lines.length && i < 50; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const candidate = detectTableDelimiter(line);
    const count = line.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

function parseCSV(text) {
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field);
        field = "";
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char === '\r') {
        continue;
      } else {
        field += char;
      }
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell && cell.trim() !== ""));
}

function parseGermanDate(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(" ");
  const datePart = parts[0];
  const timePart = parts[1];
  const [day, month, year] = datePart.split(".").map(Number);
  if (!year) return null;
  if (timePart) {
    const [hour, minute] = timePart.split(":").map(Number);
    return new Date(year, month - 1, day, hour || 0, minute || 0);
  }
  return new Date(year, month - 1, day);
}

function parseAmount(value) {
  if (!value) return 0;
  const cleaned = value
    .replace(/[^0-9,\-.]/g, "")
    .replace(/\./g, "")
    .replace(/,/, ".");
  const amount = parseFloat(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeString(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeywordList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry || "").toString().trim())
      .filter(Boolean);
  }
  if (!value) return [];
  return value
    .toString()
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeTransactionKeyList(value) {
  if (!Array.isArray(value)) return [];
  const keys = value
    .map((entry) => (entry || "").toString().trim())
    .filter(Boolean);
  return Array.from(new Set(keys));
}

function escapeHtml(value) {
  return (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeText(value, fallback = "N/A") {
  if (value === null || value === undefined || value === "") {
    return escapeHtml(fallback);
  }
  return escapeHtml(value);
}

const STOPWORDS = new Set([
  "and", "or", "the", "for", "with", "from", "into", "your", "you", "to", "of",
  "ein", "eine", "einer", "eines", "der", "die", "das", "den", "dem", "des",
  "und", "oder", "mit", "vom", "von", "für", "fuer", "bei", "im", "in", "am", "an",
  "auf", "aus", "zum", "zur", "danke", "vielen", "ihren", "ihr", "kauf",
  "rechnung", "rechn", "invoice", "bill", "payment", "zahlung", "zahlungs",
  "gmbh", "mbh", "ag", "kg", "ug", "ev", "e", "v", "llc", "inc", "ltd", "co",
  "company", "solutions", "services", "service", "online", "europe", "eu",
  "de", "com", "net", "www", "sepa", "lastschrift", "überweisung", "uberweisung"
]);

function tokenizeText(value) {
  if (!value) return [];
  const cleaned = value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, " ");
  return cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) return false;
      if (token.length < 3) return false;
      if (STOPWORDS.has(token)) return false;
      if (/^\d+$/.test(token)) return false;
      const digitCount = token.replace(/[^0-9]/g, "").length;
      if (digitCount >= Math.ceil(token.length / 2)) return false;
      return true;
    });
}

function buildKeywordCandidates(tx) {
  const baseTokens = tokenizeText([tx.payee, tx.purpose, tx.description].join(" "));
  const payeeTokens = tokenizeText(tx.payee || "");
  const bigrams = [];
  for (let i = 0; i < payeeTokens.length - 1; i++) {
    const first = payeeTokens[i];
    const second = payeeTokens[i + 1];
    if (STOPWORDS.has(first) || STOPWORDS.has(second)) continue;
    bigrams.push(`${first} ${second}`);
  }
  return new Set([...baseTokens, ...bigrams]);
}

function normalizePayee(value) {
  return normalizeString(value)
    .replace(/[0-9]{3,}/g, " ")
    .replace(/[^a-z0-9äöüß& ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTxDate(tx) {
  return tx.bookingDate || tx.cardDate || null;
}

function buildTxKey(tx) {
  const date = getTxDate(tx);
  const dateKey = date ? date.toISOString().slice(0, 10) : "nodate";
  const amountKey = tx.amount.toFixed(2);
  const payeeKey = normalizePayee(tx.payee || tx.purpose || tx.description || "");
  const purposeKey = normalizeString(tx.purpose || "").slice(0, 40);
  const categoryKey = normalizeString(tx.category || "");
  return [dateKey, amountKey, payeeKey, purposeKey, categoryKey].join("|");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB").format(value);
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  let decimals = 0;
  if (unitIndex > 0) {
    decimals = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  }
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

function getMonthKey(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

const CHART_COLORS = {
  inflow: "rgba(25, 135, 84, 0.7)",
  outflow: "rgba(220, 53, 69, 0.7)",
  net: "rgba(33, 37, 41, 0.8)"
};

const FLOW = {
  INFLOW: "inflow",
  OUTFLOW: "outflow",
  ZERO: "zero"
};

const GERMAN_PENSION = {
  rentenwert: 40.79,
  rentenwertEffectiveDate: "2025-07-01",
  durchschnittsentgelt: 51944,
  durchschnittsentgeltYear: 2026,
  rentenartfaktor: 1,
  zugangsfaktor: 1
};

const LIFE_EXPECTANCY_GERMANY = {
  year: 2023,
  male: 78.6,
  female: 83.3
};

const CATEGORY_PALETTE = [
  "rgba(13, 110, 253, 0.7)",
  "rgba(25, 135, 84, 0.7)",
  "rgba(13, 202, 240, 0.7)",
  "rgba(255, 193, 7, 0.7)",
  "rgba(253, 126, 20, 0.7)",
  "rgba(220, 53, 69, 0.7)",
  "rgba(32, 201, 151, 0.7)",
  "rgba(108, 117, 125, 0.7)",
  "rgba(33, 37, 41, 0.7)",
  "rgba(173, 181, 189, 0.7)"
];

function formatChartCurrency(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "";
  return formatCurrency(numeric);
}

function parseNetWorthDate(value) {
  if (!value) return null;
  if (value.includes("-")) {
    const parts = value.split("-").map((part) => Number(part));
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
  const parts = value.split("/").map((part) => Number(part));
  if (parts.length !== 3) return null;
  const [month, day, year] = parts;
  if (!month || !day || !year) return null;
  return new Date(year, month - 1, day);
}

function buildNetWorthSeries() {
  const sources = state.netWorth?.sources || [];
  const entries = (state.netWorth?.records || [])
    .map((entry) => ({
      ...entry,
      dateObj: parseNetWorthDate(entry.date)
    }))
    .filter((entry) => entry.dateObj instanceof Date && !Number.isNaN(entry.dateObj.valueOf()))
    .sort((a, b) => a.dateObj - b.dateObj);

  if (!entries.length) {
    return { labels: [], totals: [] };
  }

  const monthTotals = new Map();
  entries.forEach((entry) => {
    const monthKey = getMonthKey(entry.dateObj);
    if (!monthKey) return;
    const total = calculateNetWorthTotal(entry, sources);
    const existing = monthTotals.get(monthKey);
    if (!existing || entry.dateObj > existing.dateObj) {
      monthTotals.set(monthKey, { dateObj: entry.dateObj, total });
    }
  });

  const labels = [];
  const totals = [];
  const firstDate = entries[0].dateObj;
  const lastDate = entries[entries.length - 1].dateObj;
  let cursor = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
  const lastMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);

  while (cursor <= lastMonth) {
    const monthKey = getMonthKey(cursor);
    labels.push(formatMonthLabel(monthKey));
    const entry = monthTotals.get(monthKey);
    totals.push(entry ? entry.total : null);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const interpolated = totals.slice();
  for (let i = 1; i < interpolated.length - 1; i += 1) {
    if (interpolated[i] !== null) continue;
    const before = interpolated[i - 1];
    const after = interpolated[i + 1];
    if (Number.isFinite(before) && Number.isFinite(after)) {
      interpolated[i] = (before + after) / 2;
    }
  }

  return { labels, totals: interpolated };
}

function normalizeNetWorthDate(value) {
  const dateObj = parseNetWorthDate(value);
  if (!dateObj) return "";
  return [
    dateObj.getFullYear(),
    `${dateObj.getMonth() + 1}`.padStart(2, "0"),
    `${dateObj.getDate()}`.padStart(2, "0")
  ].join("-");
}

function sanitizeNetWorthSources(sources) {
  const trimmed = (sources || [])
    .map((source) => (source || "").toString().trim())
    .filter(Boolean);
  return Array.from(new Set(trimmed));
}

function calculateNetWorthTotal(record, sources) {
  return sources.reduce((sum, source) => {
    const raw = record.values ? record.values[source] : null;
    const numeric = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(numeric) ? sum + numeric : sum;
  }, 0);
}

function getLatestNetWorthTotal() {
  const sources = state.netWorth?.sources || [];
  const records = state.netWorth?.records || [];
  if (!records.length) return null;
  const withDates = records
    .map((record) => ({
      record,
      dateObj: parseNetWorthDate(record.date)
    }))
    .filter((entry) => entry.dateObj instanceof Date && !Number.isNaN(entry.dateObj.valueOf()))
    .sort((a, b) => a.dateObj - b.dateObj);
  if (!withDates.length) return null;
  const latest = withDates[withDates.length - 1].record;
  return calculateNetWorthTotal(latest, sources);
}

function sanitizeNetWorthState(raw) {
  const sources = sanitizeNetWorthSources(raw.sources);
  const records = (raw.records || [])
    .map((record) => {
      const date = normalizeNetWorthDate(record.date);
      if (!date) return null;
      const values = {};
      sources.forEach((source) => {
        const rawValue = record.values ? record.values[source] : null;
        if (rawValue === "" || rawValue === null || rawValue === undefined) {
          values[source] = null;
          return;
        }
        const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
        values[source] = Number.isFinite(numeric) ? numeric : null;
      });
      return {
        id: record.id || makeNetWorthRecordId(),
        date,
        values
      };
    })
    .filter(Boolean);

  return { sources, records };
}

function parseNetWorthValue(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.toString().trim();
  if (!trimmed) return null;

  let negative = false;
  let value = trimmed;
  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    value = value.slice(1, -1);
  }

  value = value.replace(/[^\d,.\-]/g, "");
  if (!value) return null;

  const hasComma = value.includes(",");
  const hasDot = value.includes(".");
  let normalized = value;

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "");
      normalized = normalized.replace(/,/g, ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
      normalized = normalized.replace(/,/g, "");
    } else {
      normalized = normalized.replace(/,/g, ".");
    }
  } else if (hasDot && !hasComma) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric)) return null;
  return negative ? -Math.abs(numeric) : numeric;
}

function detectTableDelimiter(headerLine) {
  const candidates = ["\t", ",", ";", "|"];
  let best = ",";
  let bestCount = 0;
  candidates.forEach((candidate) => {
    const count = headerLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  });
  return best;
}

function parseNetWorthImport(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return { ok: false, message: "Paste the net worth table first." };
  }
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { ok: false, message: "Include the header row and at least one data row." };
  }

  const delimiter = detectTableDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((header) => header.trim());
  if (headers.length < 2) {
    return { ok: false, message: "Header row must include Date and at least one source." };
  }

  const columnMap = [];
  headers.slice(1).forEach((header, index) => {
    const name = (header || "").trim();
    if (!name) return;
    if (normalizeString(name) === "total") return;
    columnMap.push({ index: index + 1, source: name });
  });

  if (!columnMap.length) {
    return { ok: false, message: "No source columns found (Total is ignored)." };
  }

  const records = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter);
    const dateRaw = (cells[0] || "").trim();
    const date = normalizeNetWorthDate(dateRaw);
    if (!date) {
      skipped += 1;
      continue;
    }

    const values = {};
    columnMap.forEach(({ index, source }) => {
      const rawValue = cells[index] || "";
      values[source] = parseNetWorthValue(rawValue);
    });

    records.push({
      id: makeNetWorthRecordId(),
      date,
      values
    });
  }

  if (!records.length) {
    return { ok: false, message: "No valid rows found after parsing." };
  }

  return {
    ok: true,
    sources: columnMap.map((item) => item.source),
    records,
    skipped,
    totalRows: lines.length - 1
  };
}

function importNetWorthFromPaste(text) {
  const parsed = parseNetWorthImport(text);
  if (!parsed.ok) return parsed;
  state.netWorth = sanitizeNetWorthState({
    sources: parsed.sources,
    records: parsed.records
  });
  saveNetWorth();
  return {
    ok: true,
    sources: state.netWorth.sources.length,
    records: state.netWorth.records.length,
    skipped: parsed.skipped,
    totalRows: parsed.totalRows
  };
}

function renderNetWorthForm() {
  const inputsWrap = el("netWorthInputs");
  const dateInput = el("netWorthDateInput");
  if (!inputsWrap || !dateInput) return;

  const sources = state.netWorth?.sources || [];
  const existingValues = {};
  inputsWrap.querySelectorAll("input[data-source]").forEach((input) => {
    existingValues[input.dataset.source] = input.value;
  });
  const existingDate = dateInput.value;

  if (!sources.length) {
    inputsWrap.innerHTML = '<div class="text-muted small">Add a source to start.</div>';
    if (!existingDate) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    updateNetWorthTotalPreview();
    return;
  }

  inputsWrap.innerHTML = sources
    .map((source, index) => {
      const safeSource = escapeHtml(source);
      const inputId = `networth-source-${index}`;
      const value = existingValues[source] ?? "";
      return `
        <div class="col-12 col-md-6 col-lg-4">
          <label class="form-label small" for="${inputId}">${safeSource}</label>
          <input id="${inputId}" class="form-control form-control-sm" type="number" step="1" data-source="${safeSource}" value="${escapeHtml(value)}" />
        </div>
      `;
    })
    .join("");

  if (!existingDate) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  updateNetWorthTotalPreview();
}

function updateNetWorthTotalPreview() {
  const preview = el("netWorthTotalPreview");
  if (!preview) return;
  const inputs = document.querySelectorAll("#netWorthInputs input[data-source]");
  let total = 0;
  let hasValue = false;
  inputs.forEach((input) => {
    const raw = input.value.trim();
    if (!raw) return;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      total += numeric;
      hasValue = true;
    }
  });
  preview.textContent = formatCurrency(hasValue ? total : 0);
}

function getNetWorthInputValues() {
  const values = {};
  document.querySelectorAll("#netWorthInputs input[data-source]").forEach((input) => {
    const source = input.dataset.source;
    const raw = input.value.trim();
    if (!raw) {
      values[source] = null;
      return;
    }
    const numeric = Number(raw);
    values[source] = Number.isFinite(numeric) ? numeric : null;
  });
  return values;
}

function clearNetWorthRecordInputs() {
  const dateInput = el("netWorthDateInput");
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  document.querySelectorAll("#netWorthInputs input[data-source]").forEach((input) => {
    input.value = "";
  });
  updateNetWorthTotalPreview();
}

function renderNetWorthTable() {
  const wrap = el("netWorthTable");
  if (!wrap) return;
  const sources = state.netWorth?.sources || [];
  const records = state.netWorth?.records || [];
  if (!records.length) {
    wrap.innerHTML = emptyState("No net worth records yet.");
    return;
  }

  const rows = records
    .slice()
    .sort((a, b) => {
      const dateA = parseNetWorthDate(a.date);
      const dateB = parseNetWorthDate(b.date);
      return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
    })
    .map((record) => {
      const dateObj = parseNetWorthDate(record.date);
      const dateLabel = dateObj ? formatDate(dateObj) : record.date;
      const cells = sources
        .map((source) => {
          const value = record.values ? record.values[source] : null;
          if (value === null || value === "" || value === undefined) {
            return "<td></td>";
          }
          return `<td>${formatCurrency(value)}</td>`;
        })
        .join("");
      const total = calculateNetWorthTotal(record, sources);
      return `
        <tr>
          <td>${dateLabel}</td>
          ${cells}
          <td class="fw-semibold">${formatCurrency(total)}</td>
          <td><button class="btn btn-sm btn-outline-danger" data-action="remove-networth" data-id="${record.id}">Delete</button></td>
        </tr>
      `;
    })
    .join("");

  wrap.innerHTML = buildTable(
    ["Date", ...sources, "Total", "Action"],
    rows
  );
}

function addNetWorthSource(source) {
  const name = (source || "").toString().trim();
  if (!name) return false;
  if (!state.netWorth) {
    state.netWorth = { sources: [], records: [] };
  }
  const normalized = normalizeString(name);
  const existing = (state.netWorth.sources || []).some(
    (item) => normalizeString(item) === normalized
  );
  if (existing) return false;
  state.netWorth.sources.push(name);
  state.netWorth.records.forEach((record) => {
    if (!record.values) record.values = {};
    if (!Object.prototype.hasOwnProperty.call(record.values, name)) {
      record.values[name] = null;
    }
  });
  saveNetWorth();
  return true;
}

function addNetWorthRecord(record) {
  if (!record || !record.date) return false;
  if (!state.netWorth) {
    state.netWorth = { sources: [], records: [] };
  }
  state.netWorth.records.push({
    id: makeNetWorthRecordId(),
    date: record.date,
    values: record.values || {}
  });
  saveNetWorth();
  return true;
}

function removeNetWorthRecord(recordId) {
  if (!state.netWorth) return;
  state.netWorth.records = state.netWorth.records.filter((record) => record.id !== recordId);
  saveNetWorth();
}

function buildYearlySeries() {
  const operatingTx = getOperatingTransactions();
  const yearly = new Map();

  operatingTx.forEach((tx) => {
    const date = getTxDate(tx);
    if (!date) return;
    const year = date.getFullYear();
    if (!yearly.has(year)) {
      yearly.set(year, { inflow: 0, outflow: 0 });
    }
    const bucket = yearly.get(year);
    const flow = getFlow(tx);
    if (flow === FLOW.INFLOW) bucket.inflow += tx.amount;
    if (flow === FLOW.OUTFLOW) bucket.outflow += Math.abs(tx.amount);
  });

  const labels = Array.from(yearly.keys()).sort((a, b) => a - b);
  return {
    labels: labels.map(String),
    inflow: labels.map((year) => yearly.get(year).inflow),
    outflow: labels.map((year) => yearly.get(year).outflow)
  };
}

function buildMonthlySeries() {
  const operatingTx = getOperatingTransactions();
  const months = Array.from(new Set(operatingTx
    .map((tx) => getMonthKey(getTxDate(tx)))
    .filter(Boolean)))
    .sort();

  const selectedMonths = months.slice(-state.rules.monthsToShow);
  const monthly = new Map(
    selectedMonths.map((month) => [month, { inflow: 0, outflow: 0 }])
  );

  operatingTx.forEach((tx) => {
    const monthKey = getMonthKey(getTxDate(tx));
    if (!monthly.has(monthKey)) return;
    const bucket = monthly.get(monthKey);
    const flow = getFlow(tx);
    if (flow === FLOW.INFLOW) bucket.inflow += tx.amount;
    if (flow === FLOW.OUTFLOW) bucket.outflow += Math.abs(tx.amount);
  });

  return {
    labels: selectedMonths.map((month) => formatMonthLabel(month)),
    monthKeys: selectedMonths,
    inflow: selectedMonths.map((month) => monthly.get(month).inflow),
    outflow: selectedMonths.map((month) => monthly.get(month).outflow),
    net: selectedMonths.map((month) => {
      const bucket = monthly.get(month);
      return bucket.inflow - bucket.outflow;
    })
  };
}

function buildCategorySeries(monthKey) {
  if (!monthKey) {
    return { labels: [], totals: [], empty: true };
  }
  const totals = new Map();
  const operatingTx = getOperatingTransactions();
  operatingTx.forEach((tx) => {
    if (getMonthKey(getTxDate(tx)) !== monthKey) return;
    if (getFlow(tx) !== FLOW.OUTFLOW) return;
    const category = tx.category || "Discretionary";
    totals.set(category, (totals.get(category) || 0) + Math.abs(tx.amount));
  });

  const entries = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  return {
    labels: entries.map(([category]) => category),
    totals: entries.map(([, total]) => total),
    empty: entries.length === 0
  };
}

function createOrUpdateChart(id, config) {
  const canvas = el(id);
  if (!canvas || !window.Chart) return;
  const existing = state.charts[id] || (typeof Chart.getChart === "function" ? Chart.getChart(canvas) : null);
  if (existing) {
    if (existing.canvas !== canvas) {
      existing.destroy();
      state.charts[id] = new Chart(canvas.getContext("2d"), config);
      return;
    }
    existing.data = config.data;
    existing.options = config.options;
    existing.update();
    return;
  }
  state.charts[id] = new Chart(canvas.getContext("2d"), config);
}

function applySelectValue(select, value) {
  if (!select) return;
  if (Array.from(select.options).some((option) => option.value === value)) {
    select.value = value;
  }
}

function showCategoryTransactions(monthKey, category) {
  const safeCategory = sanitizeCategory(category);
  if (!monthKey || !safeCategory) return;

  const txMonth = el("txMonth");
  const txCategory = el("txCategory");
  const txFlow = el("txFlow");

  state.filters.month = monthKey;
  state.filters.category = safeCategory;
  state.filters.flow = "outflow";

  applySelectValue(txMonth, monthKey);
  applySelectValue(txCategory, safeCategory);
  applySelectValue(txFlow, "outflow");

  if (typeof renderTransactionsTable === "function") {
    renderTransactionsTable();
  }

  if (typeof setActiveSection === "function") {
    setActiveSection("transactions");
  }
}

function showMonthlyTransactions(monthKey, flow) {
  if (!monthKey) return;
  const safeFlow = flow === "inflow" || flow === "outflow" ? flow : "";
  if (!safeFlow) return;

  const txMonth = el("txMonth");
  const txCategory = el("txCategory");
  const txFlow = el("txFlow");

  state.filters.month = monthKey;
  state.filters.category = "all";
  state.filters.flow = safeFlow;

  applySelectValue(txMonth, monthKey);
  applySelectValue(txCategory, "all");
  applySelectValue(txFlow, safeFlow);

  if (typeof renderTransactionsTable === "function") {
    renderTransactionsTable();
  }

  if (typeof setActiveSection === "function") {
    setActiveSection("transactions");
  }
}

function renderCharts() {
  const status = el("chartStatus");
  if (!window.Chart) {
    if (status) {
      status.textContent = "Charts are unavailable because Chart.js could not load.";
      status.classList.remove("d-none");
    }
    return;
  }

  const operatingTx = getOperatingTransactions();
  const hasData = operatingTx.length > 0;
  if (status) {
    if (!hasData) {
      status.textContent = "No budgeted transactions available for charts.";
      status.classList.remove("d-none");
    } else {
      status.classList.add("d-none");
    }
  }

  const yearly = hasData ? buildYearlySeries() : { labels: [], inflow: [], outflow: [] };
  createOrUpdateChart("yearlyChart", {
    type: "bar",
    data: {
      labels: yearly.labels,
      datasets: [
        { label: "Inflow", data: yearly.inflow, backgroundColor: CHART_COLORS.inflow },
        { label: "Outflow", data: yearly.outflow, backgroundColor: CHART_COLORS.outflow }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatChartCurrency(context.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => formatChartCurrency(value) }
        }
      }
    }
  });

  const monthly = hasData ? buildMonthlySeries() : {
    labels: [],
    monthKeys: [],
    inflow: [],
    outflow: [],
    net: []
  };
  const hasMonthlyData = monthly.monthKeys.length > 0;
  createOrUpdateChart("monthlyChart", {
    type: "bar",
    data: {
      labels: monthly.labels,
      datasets: [
        { label: "Inflow", data: monthly.inflow, backgroundColor: CHART_COLORS.inflow },
        { label: "Outflow", data: monthly.outflow, backgroundColor: CHART_COLORS.outflow }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      onClick: (event, elements, chart) => {
        if (!hasMonthlyData) return;
        const hit = elements?.[0];
        if (!hit) return;
        const index = hit.index;
        const datasetIndex = hit.datasetIndex;
        const monthKey = monthly.monthKeys[index];
        if (!monthKey) return;
        const flow = datasetIndex === 0 ? "inflow" : datasetIndex === 1 ? "outflow" : "";
        if (!flow) return;
        showMonthlyTransactions(monthKey, flow);
      },
      onHover: (event, elements) => {
        if (!event?.native) return;
        if (!hasMonthlyData) {
          event.native.target.style.cursor = "default";
          return;
        }
        event.native.target.style.cursor = elements?.length ? "pointer" : "default";
      },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatChartCurrency(context.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => formatChartCurrency(value) }
        }
      }
    }
  });

  const insightsMonth = el("insightsMonthSelect")?.value || "";
  const fallbackMonth = el("monthSelect")?.value || monthly.monthKeys[monthly.monthKeys.length - 1] || "";
  const selectedMonth = insightsMonth || fallbackMonth;
  const category = hasData ? buildCategorySeries(selectedMonth) : { labels: [], totals: [], empty: true };
  const hasCategoryData = category.labels.length > 0;
  const categoryLabels = category.labels.length ? category.labels : ["No data"];
  const categoryTotals = category.labels.length ? category.totals : [0];
  createOrUpdateChart("categoryChart", {
    type: "bar",
    data: {
      labels: categoryLabels,
      datasets: [
        {
          label: "Outflow",
          data: categoryTotals,
          backgroundColor: categoryLabels.map((_, index) => CATEGORY_PALETTE[index % CATEGORY_PALETTE.length])
        }
      ]
    },
    options: {
      responsive: true,
      animation: false,
      onClick: (event, elements, chart) => {
        if (!hasCategoryData) return;
        const hit = elements?.[0];
        if (!hit) return;
        const index = hit.index;
        const label = chart?.data?.labels?.[index];
        if (!label) return;
        const monthKey = el("insightsMonthSelect")?.value || el("monthSelect")?.value || "";
        if (!monthKey) return;
        showCategoryTransactions(monthKey, label);
      },
      onHover: (event, elements) => {
        if (!event?.native) return;
        if (!hasCategoryData) {
          event.native.target.style.cursor = "default";
          return;
        }
        event.native.target.style.cursor = elements?.length ? "pointer" : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatChartCurrency(context.parsed.y)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => formatChartCurrency(value) }
        }
      }
    }
  });
}

function renderNetWorthChart() {
  const status = el("netWorthStatus");
  if (!window.Chart) {
    if (status) {
      status.textContent = "Net worth chart unavailable because Chart.js could not load.";
      status.classList.remove("d-none");
    }
    return;
  }

  const series = buildNetWorthSeries();
  if (status) {
    if (!series.labels.length) {
      status.textContent = "No net worth records available yet.";
      status.classList.remove("d-none");
    } else {
      status.classList.add("d-none");
    }
  }

  if (!series.labels.length) return;

  let chartLabels = series.labels;
  let actualData = series.totals;
  let projectedData = null;

  if (typeof buildNetWorthProjectionSeries === "function") {
    const projection = buildNetWorthProjectionSeries();
    if (projection && projection.labels && projection.labels.length) {
      chartLabels = [...series.labels, ...projection.labels];
      actualData = [
        ...series.totals,
        ...new Array(projection.labels.length).fill(null)
      ];
      const lastActual = series.totals[series.totals.length - 1];
      projectedData = [
        ...new Array(Math.max(0, series.totals.length - 1)).fill(null),
        lastActual,
        ...projection.totals
      ];
    }
  }

  createOrUpdateChart("netWorthChart", {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: "Total",
          data: actualData,
          borderColor: "rgba(13, 110, 253, 0.9)",
          backgroundColor: "rgba(13, 110, 253, 0.15)",
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 4,
          fill: true
        },
        ...(projectedData ? [{
          label: "Projected",
          data: projectedData,
          borderColor: "rgba(13, 110, 253, 0.45)",
          backgroundColor: "rgba(13, 110, 253, 0.08)",
          borderDash: [6, 4],
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 3,
          fill: false
        }] : [])
      ]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => formatChartCurrency(context.parsed.y)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => formatChartCurrency(value) }
        }
      }
    }
  });
}

function renderNetWorthSection() {
  renderNetWorthForm();
  renderNetWorthTable();
  renderNetWorthChart();
  const pasteWrap = el("netWorthPasteWrap");
  if (pasteWrap) {
    const hasRecords = (state.netWorth?.records || []).length > 0;
    pasteWrap.classList.toggle("d-none", hasRecords);
  }
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      state.transactions = data.map((tx) => ({
        ...tx,
        bookingDate: tx.bookingDate ? new Date(tx.bookingDate) : null,
        cardDate: tx.cardDate ? new Date(tx.cardDate) : null
      }));
    } catch (error) {
      console.warn("Stored data invalid", error);
    }
  }

  const ruleStore = localStorage.getItem(RULES_KEY);
  if (ruleStore) {
    try {
      const data = JSON.parse(ruleStore);
      const hasExpenseRules = Object.prototype.hasOwnProperty.call(data, "expenseCategoryRules");
      const rawExpenseRules = hasExpenseRules
        ? data.expenseCategoryRules
        : data.categoryRules;
      const rawIncomeRules = Object.prototype.hasOwnProperty.call(data, "incomeCategoryRules")
        ? data.incomeCategoryRules
        : defaultRules.incomeCategoryRules;
      const numericOrDefault = (value, fallback) => (Number.isFinite(value) ? value : fallback);
      const numericOrNull = (value) => (Number.isFinite(value) ? value : null);
      const rawExclusionThreshold = Number.isFinite(data.exclusionThreshold)
        ? data.exclusionThreshold
        : data.highValueLimit;
      state.rules = {
        ...defaultRules,
        ...data,
        expenseCategoryRules: Array.isArray(rawExpenseRules)
          ? rawExpenseRules
          : defaultRules.expenseCategoryRules,
        incomeCategoryRules: Array.isArray(rawIncomeRules)
          ? rawIncomeRules
          : defaultRules.incomeCategoryRules,
        proposalMin: numericOrDefault(data.proposalMin, defaultRules.proposalMin),
        categoryTrendMax: numericOrDefault(data.categoryTrendMax, defaultRules.categoryTrendMax),
        exclusionThreshold: numericOrDefault(rawExclusionThreshold, defaultRules.exclusionThreshold),
        exclusionRules: Array.isArray(data.exclusionRules)
          ? data.exclusionRules
          : defaultRules.exclusionRules,
        exclusionAllowlist: Array.isArray(data.exclusionAllowlist)
          ? data.exclusionAllowlist
          : defaultRules.exclusionAllowlist,
        forecastInflowGrowth: numericOrDefault(data.forecastInflowGrowth, defaultRules.forecastInflowGrowth),
        forecastOutflowGrowth: numericOrDefault(data.forecastOutflowGrowth, defaultRules.forecastOutflowGrowth),
        forecastBaseInflow: numericOrNull(data.forecastBaseInflow),
        forecastBaseOutflow: numericOrNull(data.forecastBaseOutflow),
        forecastStartBalance: numericOrNull(data.forecastStartBalance),
        forecastUseNetWorth: typeof data.forecastUseNetWorth === "boolean"
          ? data.forecastUseNetWorth
          : defaultRules.forecastUseNetWorth,
        forecastNetWorthLookback: numericOrDefault(
          data.forecastNetWorthLookback,
          defaultRules.forecastNetWorthLookback
        ),
        forecastNetWorthMethod: FORECAST_NET_WORTH_METHODS.includes(data.forecastNetWorthMethod)
          ? data.forecastNetWorthMethod
          : defaultRules.forecastNetWorthMethod,
        forecastNetWorthGrowth: numericOrNull(data.forecastNetWorthGrowth),
        forecastNetWorthContribution: numericOrDefault(
          data.forecastNetWorthContribution,
          defaultRules.forecastNetWorthContribution
        ),
        forecastNetWorthSplits: Array.isArray(data.forecastNetWorthSplits)
          ? data.forecastNetWorthSplits
            .map((split) => sanitizeForecastSplit(split))
            .filter(Boolean)
          : defaultRules.forecastNetWorthSplits.slice(),
        retirementCurrentAge: numericOrNull(data.retirementCurrentAge),
        retirementAge: numericOrDefault(data.retirementAge, defaultRules.retirementAge),
        retirementExistingEP: numericOrNull(data.retirementExistingEP),
        retirementAnnualGross: numericOrNull(data.retirementAnnualGross),
        retirementUseInflowProxy: typeof data.retirementUseInflowProxy === "boolean"
          ? data.retirementUseInflowProxy
          : defaultRules.retirementUseInflowProxy,
        retirementGrossFactor: numericOrDefault(data.retirementGrossFactor, defaultRules.retirementGrossFactor),
        retirementSex: typeof data.retirementSex === "string"
          ? data.retirementSex
          : defaultRules.retirementSex,
        retirementLifeExpectancy: numericOrNull(data.retirementLifeExpectancy),
        retirementUseLifeExpectancy: typeof data.retirementUseLifeExpectancy === "boolean"
          ? data.retirementUseLifeExpectancy
          : defaultRules.retirementUseLifeExpectancy,
        retirementInvestedShare: numericOrDefault(
          data.retirementInvestedShare,
          defaultRules.retirementInvestedShare
        ),
        retirementMarketGrowth: numericOrDefault(
          data.retirementMarketGrowth,
          defaultRules.retirementMarketGrowth
        ),
        retirementExpenseMonths: numericOrDefault(
          data.retirementExpenseMonths,
          defaultRules.retirementExpenseMonths
        ),
        retirementExpenseMethod: RETIREMENT_EXPENSE_METHODS.includes(data.retirementExpenseMethod)
          ? data.retirementExpenseMethod
          : defaultRules.retirementExpenseMethod,
        retirementExpenseCustom: numericOrNull(data.retirementExpenseCustom),
        retirementExpenseCategories: Array.isArray(data.retirementExpenseCategories)
          ? data.retirementExpenseCategories.filter((category) =>
            DEFAULT_RETIREMENT_EXPENSE_CATEGORIES.includes(category)
          )
          : defaultRules.retirementExpenseCategories.slice()
      };
    } catch (error) {
      console.warn("Rule data invalid", error);
    }
  }
  if (state.rules && Object.prototype.hasOwnProperty.call(state.rules, "investmentKeywords")) {
    delete state.rules.investmentKeywords;
  }
  if (state.rules && Object.prototype.hasOwnProperty.call(state.rules, "highValueLimit")) {
    delete state.rules.highValueLimit;
  }
  if (state.rules && Object.prototype.hasOwnProperty.call(state.rules, "salaryKeywords")) {
    delete state.rules.salaryKeywords;
  }

  if (state.rules) {
    delete state.rules.categoryRules;
    delete state.rules.recurringMin;
    delete state.rules.recurringTolerance;
  }

  if (state.rules.expenseCategoryRules && state.rules.expenseCategoryRules.length) {
    state.rules.expenseCategoryRules = state.rules.expenseCategoryRules
      .filter((rule) => rule && rule.keyword)
      .map((rule) => ({
        id: rule.id || makeRuleId(),
        keyword: rule.keyword,
        category: sanitizeCategory(rule.category || "")
      }));
  }

  if (state.rules.incomeCategoryRules && state.rules.incomeCategoryRules.length) {
    state.rules.incomeCategoryRules = state.rules.incomeCategoryRules
      .filter((rule) => rule && rule.keyword)
      .map((rule) => ({
        id: rule.id || makeRuleId(),
        keyword: rule.keyword,
        category: sanitizeCategory(rule.category || "")
      }));
  }

  if (state.rules.exclusionRules && state.rules.exclusionRules.length) {
    state.rules.exclusionRules = state.rules.exclusionRules
      .filter((rule) => rule && rule.keyword)
      .map((rule) => ({
        id: rule.id || makeRuleId(),
        keyword: rule.keyword.trim()
      }));
  } else {
    state.rules.exclusionRules = [];
  }

  if (state.rules.exclusionAllowlist && state.rules.exclusionAllowlist.length) {
    state.rules.exclusionAllowlist = state.rules.exclusionAllowlist
      .filter((rule) => rule && rule.keyword)
      .map((rule) => ({
        id: rule.id || makeRuleId(),
        keyword: rule.keyword.trim()
      }));
  } else {
    state.rules.exclusionAllowlist = [];
  }

  const overrideStore = localStorage.getItem(OVERRIDES_KEY);
  if (overrideStore) {
    try {
      const data = JSON.parse(overrideStore);
      state.overrides = data && typeof data === "object" ? data : {};
    } catch (error) {
      console.warn("Override data invalid", error);
    }
  }

  if (state.overrides && typeof state.overrides === "object") {
    Object.values(state.overrides).forEach((override) => {
      if (!override) return;
      if (override.category && !isDefaultCategory(override.category)) {
        override.category = "";
      }
    });
  }

  const archivedStore = localStorage.getItem(ARCHIVED_RECURRING_KEY);
  if (archivedStore) {
    try {
      const data = JSON.parse(archivedStore);
      state.archivedRecurring = data && typeof data === "object" ? data : {};
    } catch (error) {
      console.warn("Archived recurring data invalid", error);
    }
  }

  const recurringStreamStore = localStorage.getItem(RECURRING_STREAMS_KEY);
  if (recurringStreamStore) {
    try {
      const data = JSON.parse(recurringStreamStore);
      state.recurringStreams = Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn("Recurring stream data invalid", error);
    }
  }

  if (state.recurringStreams && state.recurringStreams.length) {
    state.recurringStreams = state.recurringStreams
      .filter((stream) => stream && stream.keyword)
      .map((stream) => ({
        id: stream.id || makeRecurringStreamId(),
        label: stream.label || stream.keyword.trim(),
        keyword: stream.keyword.trim()
      }));
  }

  const projectStore = localStorage.getItem(PROJECTS_KEY);
  if (projectStore) {
    try {
      const data = JSON.parse(projectStore);
      if (Array.isArray(data)) {
        state.projects = data
          .filter((project) => project && (project.name || project.label))
            .map((project) => {
              const name = (project.name || project.label || "").toString().trim();
              const keywords = normalizeKeywordList(project.keywords || project.keyword);
              const manualTransactions = normalizeTransactionKeyList(project.manualTransactions);
              return {
                id: project.id || makeProjectId(),
                name,
                keywords,
                manualTransactions,
                finished: Boolean(project.finished),
                createdAt: project.createdAt || new Date().toISOString()
              };
            })
          .filter((project) => project.name && project.keywords.length);
      }
    } catch (error) {
      console.warn("Project data invalid", error);
    }
  }

  if (!Array.isArray(state.projects)) state.projects = [];

  const netWorthStore = localStorage.getItem(NET_WORTH_KEY);
  if (netWorthStore) {
    try {
      const data = JSON.parse(netWorthStore);
      state.netWorth = sanitizeNetWorthState(data);
    } catch (error) {
      console.warn("Net worth data invalid", error);
    }
  }

  if (!state.netWorth || !state.netWorth.sources?.length) {
    state.netWorth = { sources: [], records: [] };
  }

  populateCategorySelects();
  populateCategoryFilter();
  populateTagFilter();
  syncRulesToUI();
}

function saveTransactions() {
  const payload = state.transactions.map((tx) => ({
    ...tx,
    bookingDate: tx.bookingDate ? tx.bookingDate.toISOString() : null,
    cardDate: tx.cardDate ? tx.cardDate.toISOString() : null
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function saveRules() {
  localStorage.setItem(RULES_KEY, JSON.stringify(state.rules));
}

function saveOverrides() {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(state.overrides));
}

function saveArchivedRecurring() {
  localStorage.setItem(ARCHIVED_RECURRING_KEY, JSON.stringify(state.archivedRecurring));
}

function saveRecurringStreams() {
  localStorage.setItem(RECURRING_STREAMS_KEY, JSON.stringify(state.recurringStreams));
}

function saveProjects() {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(state.projects));
}

function saveNetWorth() {
  localStorage.setItem(NET_WORTH_KEY, JSON.stringify(state.netWorth));
}

function syncRulesToUI() {
  const monthsToShow = el("monthsToShow");
  if (monthsToShow) {
    monthsToShow.value = String(state.rules.monthsToShow);
  }
  if (el("proposalMin")) {
    el("proposalMin").value = state.rules.proposalMin || 2;
  }
  if (el("exclusionThreshold")) {
    el("exclusionThreshold").value = String(
      state.rules.exclusionThreshold ?? defaultRules.exclusionThreshold
    );
  }
  if (el("categoryTrendMax")) {
    el("categoryTrendMax").value = String(state.rules.categoryTrendMax ?? defaultRules.categoryTrendMax);
  }
}

const TRANSACTION_HEADER_SETS = [
  {
    id: "standard",
    required: ["Transaktionstyp", "Buchungsdatum", "Betrag"],
    optional: ["Zahlungsempfänger", "Verwendungszweck", "Beschreibung"]
  },
  {
    id: "comdirect",
    required: ["Buchungstag", "Buchungstext", "Umsatz in EUR"],
    optional: ["Wertstellung (Valuta)", "Vorgang"]
  },
  {
    id: "comdirect-visa",
    required: ["Buchungstag", "Umsatztag", "Buchungstext", "Umsatz in EUR"],
    optional: ["Vorgang", "Referenz"]
  }
];

function normalizeHeaderCell(value) {
  return (value || "").toString().replace(/^\uFEFF/, "").trim();
}

function matchTransactionHeaderFormat(row) {
  const headers = row.map(normalizeHeaderCell);
  const headerSet = new Set(headers);
  let bestFormat = null;
  let bestScore = 0;

  TRANSACTION_HEADER_SETS.forEach((format) => {
    const hasRequired = format.required.every((header) => headerSet.has(header));
    if (!hasRequired) return;
    let score = format.required.length * 2;
    format.optional.forEach((header) => {
      if (headerSet.has(header)) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      bestFormat = format.id;
    }
  });

  if (!bestFormat) return null;
  return { format: bestFormat, headers };
}

function mapRowToHeaders(headers, row) {
  const raw = {};
  headers.forEach((header, index) => {
    raw[header] = row[index] || "";
  });
  return raw;
}

function detectTransactionHeader(rows) {
  let bestIndex = 0;
  let bestScore = 0;
  let bestFormat = "standard";

  rows.forEach((row, index) => {
    const headers = row.map(normalizeHeaderCell);
    const headerSet = new Set(headers);

    TRANSACTION_HEADER_SETS.forEach((format) => {
      let score = 0;
      format.required.forEach((header) => {
        if (headerSet.has(header)) score += 2;
      });
      format.optional.forEach((header) => {
        if (headerSet.has(header)) score += 1;
      });

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
        bestFormat = format.id;
      }
    });
  });

  return {
    headerIndex: bestScore > 0 ? bestIndex : 0,
    format: bestScore > 0 ? bestFormat : "standard"
  };
}

function normalizeComdirectText(value) {
  return (value || "").toString().replace(/\s+/g, " ").trim();
}

function trimComdirectPayee(value) {
  const cleaned = normalizeComdirectText(value);
  if (!cleaned) return "";
  let cutIndex = cleaned.length;
  const tokens = [
    "Karte Nr.",
    "Kartenzahlung",
    "Ref.",
    "Referenz",
    "Kto/IBAN:",
    "IBAN:",
    "BLZ/BIC:",
    "BIC:",
    "Buchungstext:"
  ];
  tokens.forEach((token) => {
    const index = cleaned.indexOf(token);
    if (index >= 0 && index < cutIndex) {
      cutIndex = index;
    }
  });
  const dateIndex = cleaned.search(/\b20\d{2}-\d{2}-\d{2}/);
  if (dateIndex >= 0 && dateIndex < cutIndex) {
    cutIndex = dateIndex;
  }
  return cleaned.slice(0, cutIndex).trim();
}

function extractComdirectPayee(details) {
  const cleaned = normalizeComdirectText(details);
  if (!cleaned) return "";
  const labeledMatch = cleaned.match(
    /(?:EmpfÃ¤nger|Empfänger|Auftraggeber):\s*(.+?)(?=(Kto\/IBAN:|IBAN:|BLZ\/BIC:|BIC:|Buchungstext:|Ref\.|$))/i
  );
  if (labeledMatch) {
    return trimComdirectPayee(labeledMatch[1]);
  }
  const textMatch = cleaned.match(/Buchungstext:\s*(.+)$/i);
  if (textMatch) {
    return trimComdirectPayee(textMatch[1]);
  }
  return trimComdirectPayee(cleaned);
}

function extractComdirectPurpose(details) {
  const cleaned = normalizeComdirectText(details);
  if (!cleaned) return "";
  const textMatch = cleaned.match(/Buchungstext:\s*(.+)$/i);
  if (textMatch) {
    return textMatch[1].trim();
  }
  return cleaned;
}

function parseComdirectEmbeddedDate(details) {
  const cleaned = normalizeComdirectText(details);
  if (!cleaned) return null;
  const match = cleaned.match(/\b(20\d{2})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const second = Number(match[6] || 0);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hour, minute, second);
}

function parseStandardTransaction(raw) {
  return {
    type: raw["Transaktionstyp"] || "",
    bookingDate: parseGermanDate(raw["Buchungsdatum"]),
    cardDate: parseGermanDate(raw["Karteneinsatz"]),
    amount: parseAmount(raw["Betrag"]),
    payee: raw["Zahlungsempfänger"] || "",
    iban: raw["IBAN"] || "",
    bic: raw["BIC"] || "",
    purpose: raw["Verwendungszweck"] || "",
    description: raw["Beschreibung"] || "",
    accountNumber: raw["Kontonummer"] || "",
    accountName: raw["Kontoname"] || "",
    category: raw["Kategorie"] || "",
    cashWithdrawal: raw["Bargeldabhebung"] || ""
  };
}

function parseComdirectTransaction(raw) {
  const details = raw["Buchungstext"] || "";
  const payee = extractComdirectPayee(details);
  const purpose = extractComdirectPurpose(details);
  const bookingDate = parseGermanDate(raw["Buchungstag"]) || parseComdirectEmbeddedDate(details);
  const isVisa = raw["Umsatztag"] !== undefined;
  return {
    type: raw["Vorgang"] || "",
    bookingDate,
    cardDate: parseGermanDate(isVisa ? raw["Umsatztag"] : raw["Wertstellung (Valuta)"]),
    amount: parseAmount(raw["Umsatz in EUR"]),
    payee,
    iban: "",
    bic: "",
    purpose,
    description: [raw["Vorgang"], raw["Referenz"]].filter(Boolean).join(" ").trim(),
    accountNumber: "",
    accountName: "",
    category: "",
    cashWithdrawal: ""
  };
}

function parseTransactionsFromRows(rows) {
  if (rows.length < 2) return [];
  const transactions = [];
  let currentHeaders = null;
  let currentFormat = null;

  rows.forEach((row) => {
    const headerMatch = matchTransactionHeaderFormat(row);
    if (headerMatch) {
      currentHeaders = headerMatch.headers;
      currentFormat = headerMatch.format;
      return;
    }
    if (!currentHeaders || !currentFormat) return;

    const raw = mapRowToHeaders(currentHeaders, row);
    const tx = currentFormat === "standard"
      ? parseStandardTransaction(raw)
      : parseComdirectTransaction(raw);

    const amountField = currentFormat === "standard" ? "Betrag" : "Umsatz in EUR";
    const amountRaw = (raw[amountField] || "").toString();
    const hasAmountDigits = /\d/.test(amountRaw);
    const hasAmount = hasAmountDigits && Number.isFinite(tx.amount) && tx.amount !== 0;
    const hasDate = Boolean(getTxDate(tx));
    const hasDetails = Boolean((tx.payee || tx.purpose || tx.description || "").trim());

    if (!hasAmountDigits) return;
    if (!hasAmount && !(hasDate && hasDetails)) return;

    tx.key = buildTxKey(tx);
    transactions.push(tx);
  });

  return transactions;
}

function makeRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeRecurringStreamId() {
  return `stream_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeProjectId() {
  return `project_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeNetWorthRecordId() {
  return `networth_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeForecastSplitId() {
  return `forecast_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sanitizeForecastSplit(raw) {
  if (!raw || typeof raw !== "object") return null;
  const normalizeNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };
  const label = (raw.label || "").toString();
  const weight = normalizeNumber(raw.weight);
  const growth = normalizeNumber(raw.growth);
  return {
    id: raw.id || makeForecastSplitId(),
    label: label.trim(),
    weight,
    growth
  };
}

function addForecastSplit() {
  if (!state.rules.forecastNetWorthSplits) {
    state.rules.forecastNetWorthSplits = [];
  }
  const index = state.rules.forecastNetWorthSplits.length + 1;
  state.rules.forecastNetWorthSplits.push({
    id: makeForecastSplitId(),
    label: `Part ${index}`,
    weight: 1,
    growth: null
  });
  saveRules();
  return true;
}

function updateForecastSplit(splitId, updates) {
  if (!splitId) return false;
  const splits = state.rules.forecastNetWorthSplits || [];
  const split = splits.find((item) => item.id === splitId);
  if (!split) return false;
  if (Object.prototype.hasOwnProperty.call(updates, "label")) {
    split.label = (updates.label || "").toString();
  }
  if (Object.prototype.hasOwnProperty.call(updates, "weight")) {
    split.weight = Number.isFinite(updates.weight) ? updates.weight : null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "growth")) {
    split.growth = Number.isFinite(updates.growth) ? updates.growth : null;
  }
  saveRules();
  return true;
}

function removeForecastSplit(splitId) {
  if (!splitId) return false;
  state.rules.forecastNetWorthSplits = (state.rules.forecastNetWorthSplits || [])
    .filter((item) => item.id !== splitId);
  saveRules();
  return true;
}

function addCategoryRule(rule, ruleType) {
  const keyword = normalizeString(rule.keyword);
  if (!keyword) return false;
  const category = sanitizeCategory(rule.category);
  const list = ruleType === "income"
    ? state.rules.incomeCategoryRules
    : state.rules.expenseCategoryRules;
  list.push({
    id: makeRuleId(),
    keyword: rule.keyword.trim(),
    category
  });
  saveRules();
  return true;
}

function seedDefaultCategoryRulesIfEmpty() {
  const expenseCount = state.rules?.expenseCategoryRules?.length || 0;
  const incomeCount = state.rules?.incomeCategoryRules?.length || 0;
  if (expenseCount || incomeCount) return false;

  const buildSeedRules = (seeds) => seeds
    .map((seed) => {
      const keyword = (seed.keyword || "").trim();
      const category = sanitizeCategory(seed.category || "");
      if (!keyword || !category) return null;
      return {
        id: makeRuleId(),
        keyword,
        category
      };
    })
    .filter(Boolean);

  state.rules.expenseCategoryRules = buildSeedRules(DEFAULT_RULE_SEEDS.expense);
  state.rules.incomeCategoryRules = buildSeedRules(DEFAULT_RULE_SEEDS.income);
  saveRules();
  return true;
}

function seedRecurringStreamsIfEmpty() {
  if (state.recurringStreams && state.recurringStreams.length) return false;
  refreshDerived();
  const detected = detectRecurringStreams(state.view.analyzed);
  if (!detected.length) return false;
  state.recurringStreams = detected;
  saveRecurringStreams();
  return true;
}

function detectRecurringStreams(transactions) {
  const txs = (transactions || []).filter((tx) => getFlow(tx) === FLOW.OUTFLOW);
  if (!txs.length) return [];

  const entries = new Map();
  txs.forEach((tx) => {
    const date = getTxDate(tx);
    if (!date) return;
    const amount = Math.abs(tx.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const keywords = buildKeywordCandidates(tx);
    if (!keywords.size) return;
    const label = (tx.payee || tx.purpose || tx.description || "").trim();
    keywords.forEach((keyword) => {
      const normalized = normalizeString(keyword);
      if (!normalized) return;
      let entry = entries.get(normalized);
      if (!entry) {
        entry = {
          keyword: normalized,
          count: 0,
          total: 0,
          dates: [],
          amounts: [],
          labels: new Map(),
          payees: new Set()
        };
        entries.set(normalized, entry);
      }
      entry.count += 1;
      entry.total += amount;
      entry.dates.push(date);
      entry.amounts.push(amount);
      if (label) {
        entry.labels.set(label, (entry.labels.get(label) || 0) + 1);
      }
      const payeeKey = normalizeString(tx.payee || tx.purpose || tx.description || "");
      if (payeeKey) {
        entry.payees.add(payeeKey);
      }
    });
  });

  const msPerDay = 24 * 60 * 60 * 1000;
  const medianValue = (values) => {
    if (!values || !values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const titleCase = (value) => value
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .trim();

  const pickLabel = (labels, fallback) => {
    if (!labels || !labels.size) return titleCase(fallback);
    let best = "";
    let bestCount = 0;
    labels.forEach((count, label) => {
      if (count > bestCount) {
        best = label;
        bestCount = count;
      }
    });
    return best || titleCase(fallback);
  };

  const monthIndex = (date) => date.getFullYear() * 12 + date.getMonth();
  const minCount = 3;
  const minCadence = 7;
  const maxCadence = 62;
  const maxPerMonth = 4.5;
  const maxPayees = 3;
  const amountTolerance = 0.35;
  const minStableShare = 0.6;
  const maxStreams = 8;

  const candidates = [];
  entries.forEach((entry) => {
    if (entry.count < minCount) return;
    const dates = entry.dates.slice().sort((a, b) => a - b);
    if (dates.length < minCount) return;

    const intervals = [];
    for (let i = 1; i < dates.length; i += 1) {
      const delta = (dates[i] - dates[i - 1]) / msPerDay;
      if (delta > 0) intervals.push(delta);
    }
    if (!intervals.length) return;

    const cadence = medianValue(intervals);
    if (!cadence || cadence < minCadence || cadence > maxCadence) return;

    if (entry.payees && entry.payees.size > maxPayees) return;

    const monthsSpan = monthIndex(dates[dates.length - 1]) - monthIndex(dates[0]) + 1;
    const avgPerMonth = monthsSpan > 0 ? entry.count / monthsSpan : entry.count;
    if (avgPerMonth > maxPerMonth) return;

    const medianAmount = medianValue(entry.amounts);
    if (!medianAmount || !Number.isFinite(medianAmount)) return;
    const stableShare = entry.amounts
      .filter((value) => Math.abs(value - medianAmount) / medianAmount <= amountTolerance)
      .length / entry.amounts.length;
    if (stableShare < minStableShare) return;

    candidates.push({
      keyword: entry.keyword,
      label: pickLabel(entry.labels, entry.keyword),
      total: entry.total,
      count: entry.count
    });
  });

  candidates.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.count !== a.count) return b.count - a.count;
    return a.keyword.length - b.keyword.length;
  });

  const selected = [];
  for (const candidate of candidates) {
    if (selected.length >= maxStreams) break;
    const overlaps = selected.some((item) =>
      item.keyword.includes(candidate.keyword) || candidate.keyword.includes(item.keyword)
    );
    if (overlaps) continue;
    selected.push(candidate);
  }

  return selected.map((item) => ({
    id: makeRecurringStreamId(),
    label: item.label,
    keyword: item.keyword
  }));
}

function addExpenseRule(rule) {
  return addCategoryRule(rule, "expense");
}

function addIncomeRule(rule) {
  return addCategoryRule(rule, "income");
}

function addExclusionRule(rule) {
  const keyword = normalizeString(rule.keyword);
  if (!keyword) return false;
  if (!state.rules.exclusionRules) state.rules.exclusionRules = [];
  state.rules.exclusionRules.push({
    id: makeRuleId(),
    keyword: rule.keyword.trim()
  });
  saveRules();
  return true;
}

function addExclusionAllowRule(rule) {
  const keyword = normalizeString(rule.keyword);
  if (!keyword) return false;
  if (!state.rules.exclusionAllowlist) state.rules.exclusionAllowlist = [];
  state.rules.exclusionAllowlist.push({
    id: makeRuleId(),
    keyword: rule.keyword.trim()
  });
  saveRules();
  return true;
}

function removeExclusionRule(ruleId) {
  if (!ruleId) return;
  state.rules.exclusionRules = (state.rules.exclusionRules || []).filter((rule) => rule.id !== ruleId);
  saveRules();
}

function removeExclusionAllowRule(ruleId) {
  if (!ruleId) return;
  state.rules.exclusionAllowlist = (state.rules.exclusionAllowlist || [])
    .filter((rule) => rule.id !== ruleId);
  saveRules();
}

function removeCategoryRule(ruleId, ruleType) {
  const listName = ruleType === "income" ? "incomeCategoryRules" : "expenseCategoryRules";
  state.rules[listName] = (state.rules[listName] || []).filter((rule) => rule.id !== ruleId);
  saveRules();
}

function applyCategoryRules(tx) {
  const rules = tx.amount > 0
    ? state.rules.incomeCategoryRules
    : state.rules.expenseCategoryRules;
  if (!rules || !rules.length) return null;
  const haystack = normalizeString([
    tx.payee,
    tx.purpose,
    tx.description
  ].join(" "));
  for (const rule of rules) {
    const keyword = normalizeString(rule.keyword);
    if (!keyword) continue;
    if (haystack.includes(keyword)) {
      const ruleCategory = sanitizeCategory(rule.category);
      return {
        category: ruleCategory,
        keyword: rule.keyword
      };
    }
  }
  return null;
}

function applyExclusionRules(tx) {
  const rules = state.rules.exclusionRules || [];
  if (!rules.length) return null;
  const allowlist = state.rules.exclusionAllowlist || [];
  const haystack = normalizeString([
    tx.payee,
    tx.purpose,
    tx.description
  ].join(" "));
  if (allowlist.length) {
    for (const rule of allowlist) {
      const keyword = normalizeString(rule.keyword);
      if (!keyword) continue;
      if (haystack.includes(keyword)) {
        return null;
      }
    }
  }
  for (const rule of rules) {
    const keyword = normalizeString(rule.keyword);
    if (!keyword) continue;
    if (haystack.includes(keyword)) {
      return rule.keyword;
    }
  }
  return null;
}

function getRecurringStreamMatches(stream, transactions) {
  const keyword = normalizeString(stream.keyword);
  if (!keyword) return [];
  return transactions.filter((tx) => {
    if (getFlow(tx) !== FLOW.OUTFLOW) return false;
    const haystack = normalizeString([
      tx.payee,
      tx.purpose,
      tx.description
    ].join(" "));
    return haystack.includes(keyword);
  });
}

function buildRecurringStreamStats(stream, year, transactions) {
  const matches = getRecurringStreamMatches(stream, transactions)
    .filter((tx) => {
      const date = getTxDate(tx);
      return date && date.getFullYear() === year;
    })
    .sort((a, b) => getTxDate(b) - getTxDate(a));

  const total = matches.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const lastDate = matches.length ? getTxDate(matches[0]) : null;
  return {
    count: matches.length,
    total,
    lastDate
  };
}

function addRecurringStream(stream) {
  const keyword = stream.keyword.trim();
  if (!keyword) return false;
  const label = (stream.label || keyword).trim();
  state.recurringStreams.push({
    id: makeRecurringStreamId(),
    label,
    keyword
  });
  saveRecurringStreams();
  return true;
}

function updateRecurringStream(streamId, updates) {
  const stream = state.recurringStreams.find((item) => item.id === streamId);
  if (!stream) return false;
  const keyword = updates.keyword.trim();
  if (!keyword) return false;
  stream.label = (updates.label || keyword).trim();
  stream.keyword = keyword;
  saveRecurringStreams();
  return true;
}

function removeRecurringStream(streamId) {
  state.recurringStreams = state.recurringStreams.filter((stream) => stream.id !== streamId);
  saveRecurringStreams();
}

function addProject(project) {
  const name = (project.name || "").trim();
  const keywords = normalizeKeywordList(project.keywords || project.keyword);
  if (!name || !keywords.length) return false;
  state.projects.push({
    id: makeProjectId(),
    name,
    keywords,
    manualTransactions: [],
    finished: Boolean(project.finished),
    createdAt: new Date().toISOString()
  });
  saveProjects();
  return true;
}

function updateProject(projectId, updates) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return false;
  const name = (updates.name || project.name || "").trim();
  const keywords = normalizeKeywordList(updates.keywords ?? project.keywords);
  if (!name || !keywords.length) return false;
  project.name = name;
  project.keywords = keywords;
  if (Object.prototype.hasOwnProperty.call(updates, "finished")) {
    project.finished = Boolean(updates.finished);
  }
  saveProjects();
  return true;
}

function removeProject(projectId) {
  if (!projectId) return;
  state.projects = state.projects.filter((project) => project.id !== projectId);
  saveProjects();
}

function toggleProjectFinished(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  project.finished = !project.finished;
  saveProjects();
}

function addProjectTransaction(projectId, txKey) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project || !txKey) return false;
  if (!Array.isArray(project.manualTransactions)) {
    project.manualTransactions = [];
  }
  const normalized = txKey.toString().trim();
  if (!normalized) return false;
  if (!project.manualTransactions.includes(normalized)) {
    project.manualTransactions.push(normalized);
    saveProjects();
  }
  return true;
}

function removeProjectTransaction(projectId, txKey) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project || !txKey || !Array.isArray(project.manualTransactions)) return false;
  const normalized = txKey.toString().trim();
  const next = project.manualTransactions.filter((key) => key !== normalized);
  project.manualTransactions = next;
  saveProjects();
  return true;
}

function getProjectMatches(project, transactions) {
  const list = transactions || [];
  if (!list.length) return [];
  const manualKeys = new Set(normalizeTransactionKeyList(project.manualTransactions));
  const keywords = normalizeKeywordList(project.keywords);
  const haystacks = keywords.map((keyword) => normalizeString(keyword)).filter(Boolean);
  const matches = [];
  const seen = new Set();

  list.forEach((tx) => {
    if (manualKeys.has(tx.key)) {
      matches.push(tx);
      seen.add(tx.key);
      return;
    }
    if (!haystacks.length) return;
    const haystack = normalizeString([
      tx.payee,
      tx.purpose,
      tx.description
    ].join(" "));
    if (!haystack) return;
    if (haystacks.some((keyword) => haystack.includes(keyword))) {
      if (!seen.has(tx.key)) {
        matches.push(tx);
        seen.add(tx.key);
      }
    }
  });

  return matches;
}

function getDefaultCategory(tx) {
  if (tx.amount > 0) return "Income";
  return "Discretionary";
}

function deriveTransaction(tx) {
  const autoRule = applyCategoryRules(tx);
  const override = state.overrides[tx.key];
  const manualCategory = sanitizeCategory(override && override.category ? override.category : "");
  const ruleCategory = autoRule ? sanitizeCategory(autoRule.category) : "";
  const category = manualCategory || ruleCategory || getDefaultCategory(tx);
  const manualExclude = override && override.exclude ? true : false;
  const exclusionKeyword = applyExclusionRules(tx);
  const threshold = Number.isFinite(state.rules.exclusionThreshold)
    ? state.rules.exclusionThreshold
    : defaultRules.exclusionThreshold;
  const exceedsThreshold = Number.isFinite(threshold)
    && threshold > 0
    && Math.abs(tx.amount) >= threshold;
  const excluded = Boolean(manualExclude || exclusionKeyword || exceedsThreshold);
  const excludedReason = manualExclude
    ? "Manual override"
    : exclusionKeyword
      ? `Rule: ${exclusionKeyword}`
      : exceedsThreshold
        ? `Amount >= ${formatCurrency(threshold)}`
        : "";
  const categorySource = manualCategory
    ? "manual"
    : ruleCategory
      ? "rule"
      : "default";

  return {
    ...tx,
    category,
    excluded,
    excludedReason,
    categorySource,
    matchedRule: autoRule ? autoRule.keyword : ""
  };
}

function refreshDerived() {
  const derived = state.transactions.map((tx) => deriveTransaction(tx));
  state.view = {
    derived,
    analyzed: derived.filter((tx) => !tx.excluded)
  };
}

function isArchivedRecurring(key) {
  return Boolean(state.archivedRecurring && state.archivedRecurring[key]);
}

function archiveRecurringItem(item) {
  if (!item || !item.key) return;
  if (!state.archivedRecurring) state.archivedRecurring = {};
  state.archivedRecurring[item.key] = {
    key: item.key,
    label: item.label || "N/A",
    amount: item.amount,
    cadence: item.cadence,
    category: item.category || "",
    lastDate: item.lastDate ? item.lastDate.toISOString() : null,
    archivedAt: new Date().toISOString()
  };
  saveArchivedRecurring();
  render();
}

function unarchiveRecurringItem(key) {
  if (!key || !state.archivedRecurring) return;
  delete state.archivedRecurring[key];
  saveArchivedRecurring();
  render();
}

function buildProposals(transactions, minMatches) {
  const existingRules = new Set(
    (state.rules.expenseCategoryRules || []).map((rule) => normalizeString(rule.keyword))
  );
  const entries = new Map();

  transactions.forEach((tx) => {
    if (tx.categorySource === "rule" || tx.categorySource === "manual") return;
    const keywords = buildKeywordCandidates(tx);
    keywords.forEach((keyword) => {
      if (existingRules.has(keyword)) return;
      if (!entries.has(keyword)) {
        entries.set(keyword, {
          keyword,
          count: 0,
          total: 0,
          txKeys: new Set(),
          categories: new Map(),
          samples: [],
          lastDate: null
        });
      }
      const entry = entries.get(keyword);
      if (entry.txKeys.has(tx.key)) return;
      entry.txKeys.add(tx.key);
      entry.count += 1;
      entry.total += Math.abs(tx.amount || 0);
      if (tx.category && isDefaultCategory(tx.category)) {
        entry.categories.set(tx.category, (entry.categories.get(tx.category) || 0) + 1);
      }
      if (entry.samples.length < 5) {
        entry.samples.push({
          payee: tx.payee || "",
          purpose: tx.purpose || "",
          amount: tx.amount,
          category: tx.category || getDefaultCategory(tx)
        });
      }
      const date = getTxDate(tx);
      if (date && (!entry.lastDate || date > entry.lastDate)) {
        entry.lastDate = date;
      }
    });
  });

  const proposals = [];
  entries.forEach((entry) => {
    if (entry.count < minMatches) return;
    const sortedCategories = Array.from(entry.categories.entries()).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCategories.length ? sortedCategories[0][0] : "Discretionary";
    const topCategoryCount = sortedCategories.length ? sortedCategories[0][1] : 0;
    const coverage = entry.count ? topCategoryCount / entry.count : 0;

    proposals.push({
      keyword: entry.keyword,
      count: entry.count,
      total: entry.total,
      category: topCategory,
      coverage,
      samples: entry.samples
    });
  });

  return proposals
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.count !== a.count) return b.count - a.count;
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      return b.keyword.length - a.keyword.length;
    })
    .slice(0, 50);
}

function renderProposedRules() {
  const wrap = el("proposalTableWrap");
  const minMatches = Number(state.rules.proposalMin) || 2;
  const header = el("proposalHeader");
  const eligibleTx = state.view.derived.filter((tx) => !tx.excluded);
  if (!eligibleTx.length) {
    wrap.innerHTML = emptyState("No data loaded yet.");
    if (header) header.textContent = "Proposed Rules";
    return;
  }

  const expenseTx = eligibleTx.filter((tx) => tx.amount < 0);
  if (header) {
    const uncategorized = expenseTx.filter((tx) => tx.categorySource === "default").length;
    const percent = expenseTx.length
      ? Math.round((uncategorized / expenseTx.length) * 100)
      : 0;
    header.textContent = `Proposed Rules (${percent}% uncategorized)`;
  }
  const proposals = buildProposals(expenseTx, minMatches);
  if (!proposals.length) {
    wrap.innerHTML = emptyState(`No proposed rules (min matches: ${minMatches}).`);
    return;
  }

  const rows = proposals
    .map((proposal) => {
      const coverageLabel = proposal.coverage
        ? `${Math.round(proposal.coverage * 100)}%`
        : "N/A";
      const totalLabel = Number.isFinite(proposal.total)
        ? formatCurrency(proposal.total)
        : "N/A";
      const sampleHtml = proposal.samples && proposal.samples.length
        ? `
          <div class="d-flex flex-column gap-1 small">
            ${proposal.samples.map((sample) => `
              <div>
                <span class="fw-semibold">${safeText(sample.payee || "N/A")}</span>
                <span class="text-muted">·</span>
                <span>${safeText(sample.purpose || "—")}</span>
                <span class="text-muted">·</span>
                <span>${formatCurrency(sample.amount)}</span>
                <span class="text-muted">·</span>
                <span>${safeText(sample.category || "Discretionary")}</span>
              </div>
            `).join("")}
          </div>
        `
        : "N/A";
      return `
        <tr>
          <td><input class="form-control form-control-sm proposal-keyword" type="text" value="${escapeHtml(proposal.keyword)}" /></td>
          <td>${proposal.count}</td>
          <td class="text-danger fw-semibold">${totalLabel}</td>
          <td>
            <select class="form-select form-select-sm proposal-category">
              ${categoryOptionsHtml(proposal.category || "Discretionary")}
            </select>
          </td>
          <td>${coverageLabel}</td>
          <td>
            <button class="btn btn-sm btn-outline-secondary" data-action="apply-proposal">Add rule</button>
          </td>
        </tr>
        <tr>
          <td colspan="6" class="text-break">${sampleHtml}</td>
        </tr>
      `;
    })
    .join("");

  wrap.innerHTML = `
    <table class="table table-sm table-striped align-middle mb-0 proposal-table">
      <thead>
        <tr>
          <th>Keyword</th>
          <th>Matches</th>
          <th>Total</th>
          <th>Category</th>
          <th>Coverage</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function setOverrideTarget(tx) {
  if (!tx) return;
  state.overrideTargetKey = tx.key;
  const existing = state.overrides[tx.key];
  el("overrideSelection").textContent = `${formatDate(getTxDate(tx))} · ${tx.payee || tx.purpose || "N/A"} · ${formatCurrency(tx.amount)}`;
  const manualCategory = existing && existing.category ? sanitizeCategory(existing.category) : "";
  const currentCategory = manualCategory || sanitizeCategory(tx.category) || "";
  el("overrideCategory").value = currentCategory;
  el("overrideExclude").checked = existing && existing.exclude ? true : false;
}

function clearOverrideForm() {
  state.overrideTargetKey = null;
  el("overrideSelection").textContent = "Select a transaction from the list below.";
  el("overrideCategory").value = "";
  el("overrideExclude").checked = false;
}

function saveOverrideForTarget() {
  const key = state.overrideTargetKey;
  if (!key) return;
  const category = sanitizeCategory(el("overrideCategory").value);
  const exclude = el("overrideExclude").checked;

  if (!category && !exclude) {
    delete state.overrides[key];
  } else {
    state.overrides[key] = {
      category,
      exclude,
      updatedAt: new Date().toISOString()
    };
  }
  saveOverrides();
  render();
}

function applyCategoryOverride(key, category) {
  if (!key) return;
  const existing = state.overrides[key] || {};
  if (!category && !existing.exclude) {
    delete state.overrides[key];
  } else {
    state.overrides[key] = {
      category,
      exclude: Boolean(existing.exclude),
      updatedAt: new Date().toISOString()
    };
  }
  saveOverrides();
}
async function importCSV(file) {
  const text = await file.text();
  const rows = parseCSV(text);
  const newTransactions = parseTransactionsFromRows(rows);

  const existingMap = new Map(state.transactions.map((tx) => [tx.key, tx]));
  let added = 0;

  for (const tx of newTransactions) {
    if (!existingMap.has(tx.key)) {
      existingMap.set(tx.key, tx);
      state.transactions.push(tx);
      added++;
    }
  }

  saveTransactions();
  render();

  el("importStatus").textContent = `${newTransactions.length} records found, ${added} added.`;
}

function collectBackupStores() {
  const stores = {};
  const total = localStorage.length;
  for (let i = 0; i < total; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(BACKUP_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value === null) continue;
    try {
      stores[key] = JSON.parse(value);
    } catch (error) {
      stores[key] = value;
    }
  }
  return stores;
}

function clearBackupStores() {
  const keysToRemove = [];
  const total = localStorage.length;
  for (let i = 0; i < total; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(BACKUP_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
  return keysToRemove.length;
}

function buildBackupPayload() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores: collectBackupStores()
  };
}

function restoreBackupStores(stores) {
  if (!stores || typeof stores !== "object") return 0;
  clearBackupStores();

  let restored = 0;
  Object.entries(stores).forEach(([key, value]) => {
    if (!key || !key.startsWith(BACKUP_PREFIX)) return;
    if (typeof value === "string") {
      localStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
    restored += 1;
  });
  return restored;
}

function parseBackupDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeBackupTransaction(raw) {
  if (!raw || typeof raw !== "object") return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount)) return null;
  const tx = {
    type: raw.type || "",
    bookingDate: parseBackupDate(raw.bookingDate),
    cardDate: parseBackupDate(raw.cardDate),
    amount,
    payee: raw.payee || "",
    iban: raw.iban || "",
    bic: raw.bic || "",
    purpose: raw.purpose || "",
    description: raw.description || "",
    accountNumber: raw.accountNumber || "",
    accountName: raw.accountName || "",
    category: raw.category || "",
    cashWithdrawal: raw.cashWithdrawal || ""
  };
  tx.key = raw.key || buildTxKey(tx);
  return tx;
}

async function importJSON(file) {
  const status = el("importStatus");
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    console.warn("JSON backup invalid", error);
    if (status) status.textContent = "Invalid JSON file. Please select a backup JSON.";
    return;
  }

  const backupStores = data && typeof data === "object" && !Array.isArray(data)
    ? data.stores
    : null;
  if (backupStores && typeof backupStores === "object") {
    const restored = restoreBackupStores(backupStores);
    resetStateToDefaults();
    loadState();
    render();
    if (typeof clearNetWorthImportStatus === "function") {
      clearNetWorthImportStatus();
    }
    clearOverrideForm();
    clearRecurringForm();
    clearProjectForm();
    if (status) {
      const details = [
        `${state.transactions.length} transaction(s)`,
        `${state.recurringStreams.length} stream(s)`,
        `${state.projects.length} project(s)`
      ];
      status.textContent = `Backup restored (${restored} item(s)). ${details.join(", ")}.`;
    }
    return;
  }

  const rawTransactions = Array.isArray(data)
    ? data
    : (data && Array.isArray(data.transactions) ? data.transactions : null);
  if (!Array.isArray(rawTransactions)) {
    if (status) status.textContent = "JSON backup format not recognized.";
    return;
  }

  let skipped = 0;
  const transactions = rawTransactions
    .map((raw) => {
      const normalized = normalizeBackupTransaction(raw);
      if (!normalized) skipped += 1;
      return normalized;
    })
    .filter(Boolean);

  state.transactions = transactions;
  saveTransactions();
  render();

  const skippedMessage = skipped ? ` Skipped ${skipped} invalid record(s).` : "";
  if (status) {
    status.textContent = `Restored ${transactions.length} transaction(s) from JSON.${skippedMessage}`;
  }
}

function normalizeAmazonText(value) {
  const trimmed = (value || "").toString().trim();
  if (!trimmed) return "";
  if (normalizeString(trimmed) === "not available") return "";
  return trimmed;
}

function parseAmazonDate(value) {
  const raw = normalizeAmazonText(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAmazonQuantity(value) {
  const numeric = Number.parseInt((value || "").toString(), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function parseAmazonMoney(value) {
  const numeric = parseNetWorthValue(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isAmazonTransaction(tx) {
  const haystack = normalizeString([tx.payee, tx.purpose, tx.description].join(" "));
  return AMAZON_MERCHANT_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function truncateText(value, maxLength = 160) {
  const text = (value || "").toString();
  if (text.length <= maxLength) return text;
  const safeMax = Math.max(0, maxLength - 3);
  return `${text.slice(0, safeMax).trim()}...`;
}

function buildAmazonItemLabel(item) {
  if (!item) return "";
  const name = item.name || "Amazon item";
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 1;
  return quantity > 1 ? `${name} (x${quantity})` : name;
}

function buildAmazonSummary(items, limit = 3) {
  if (!items || !items.length) return "";
  const grouped = new Map();
  items.forEach((item) => {
    const name = (item.name || "").trim();
    if (!name) return;
    const entry = grouped.get(name) || { name, quantity: 0 };
    entry.quantity += Number.isFinite(item.quantity) ? item.quantity : 1;
    grouped.set(name, entry);
  });
  const entries = Array.from(grouped.values());
  if (!entries.length) return "";
  entries.sort((a, b) => b.quantity - a.quantity);
  const visible = entries.slice(0, limit);
  const labels = visible.map((entry) =>
    entry.quantity > 1 ? `${entry.name} (x${entry.quantity})` : entry.name
  );
  let summary = labels.join("; ");
  const remaining = entries.length - visible.length;
  if (remaining > 0) summary += `; +${remaining} more`;
  return truncateText(summary, 180);
}

function setAmazonDescription(tx, summary) {
  if (!tx) return;
  const cleaned = summary ? summary.trim() : "";
  const description = cleaned ? `${AMAZON_DESCRIPTION_PREFIX} ${cleaned}` : AMAZON_DESCRIPTION_PREFIX;
  tx.description = description;
}

function findBestAmazonMatch(target, candidates, usedKeys, options) {
  const { amountTolerance = 1, dateToleranceDays = 10 } = options || {};
  const targetAmount = Math.abs(target.amount || 0);
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return null;
  const targetDate = target.date || null;
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    if (!candidate || usedKeys.has(candidate.key)) return;
    if (!Number.isFinite(candidate.amount) || candidate.amount <= 0) return;
    const amountDiff = Math.abs(candidate.amount - targetAmount);
    if (amountDiff > amountTolerance) return;
    let dateDiff = 0;
    if (targetDate && candidate.date) {
      dateDiff = Math.abs(candidate.date - targetDate) / (24 * 60 * 60 * 1000);
      if (dateDiff > dateToleranceDays) return;
    }
    const score = amountDiff * 10 + dateDiff;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
}

async function importAmazonOrders(file) {
  const status = el("importStatus");
  if (!state.transactions.length) {
    if (status) status.textContent = "Import transactions before adding Amazon order history.";
    return;
  }

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) {
    if (status) status.textContent = "Amazon order history file appears to be empty.";
    return;
  }

  const header = rows[0].map((cell) => (cell || "").replace(/^\uFEFF/, "").trim());
  const headerIndex = new Map();
  header.forEach((label, index) => {
    const key = normalizeString(label);
    if (key && !headerIndex.has(key)) {
      headerIndex.set(key, index);
    }
  });

  const getColumn = (row, names) => {
    for (const name of names) {
      const key = normalizeString(name);
      if (headerIndex.has(key)) {
        return row[headerIndex.get(key)] || "";
      }
    }
    return "";
  };

  const required = [
    { label: "Order ID", keys: ["order id"] },
    { label: "Product Name", keys: ["product name", "title"] }
  ];
  const missingRequired = required.filter((entry) =>
    !entry.keys.some((key) => headerIndex.has(normalizeString(key)))
  );
  if (missingRequired.length) {
    if (status) {
      status.textContent = "Order history CSV missing required columns (Order ID, Product Name).";
    }
    return;
  }

  const orders = new Map();
  let skippedRows = 0;
  let currencySkipped = 0;
  let missingAmount = 0;

  rows.slice(1).forEach((row) => {
    const orderId = normalizeAmazonText(getColumn(row, ["Order ID"]));
    const productName = normalizeAmazonText(getColumn(row, ["Product Name", "Title"]));
    if (!orderId || !productName) {
      skippedRows += 1;
      return;
    }

    const currency = normalizeAmazonText(getColumn(row, ["Currency"]));
    if (currency && normalizeString(currency) !== "eur") {
      currencySkipped += 1;
      return;
    }

    const orderDate = parseAmazonDate(getColumn(row, ["Order Date"]));
    const shipDate = parseAmazonDate(getColumn(row, ["Ship Date"]));
    const quantity = parseAmazonQuantity(getColumn(row, ["Original Quantity", "Quantity"]));

    let total = parseAmazonMoney(getColumn(row, ["Total Amount", "Item Total", "Order Total"]));
    if (!Number.isFinite(total)) {
      const subtotal = parseAmazonMoney(getColumn(row, ["Shipment Item Subtotal", "Item Subtotal"])) || 0;
      const tax = parseAmazonMoney(getColumn(row, ["Shipment Item Subtotal Tax", "Item Subtotal Tax"])) || 0;
      const shipping = parseAmazonMoney(getColumn(row, ["Shipping Charge", "Shipping"])) || 0;
      const discount = parseAmazonMoney(getColumn(row, ["Total Discounts", "Discount"])) || 0;
      const computed = subtotal + tax + shipping - discount;
      if (Number.isFinite(computed) && computed > 0) {
        total = computed;
      }
    }
    if (!Number.isFinite(total)) {
      const unitPrice = parseAmazonMoney(getColumn(row, ["Unit Price"])) || 0;
      const unitTax = parseAmazonMoney(getColumn(row, ["Unit Price Tax"])) || 0;
      const computed = (unitPrice + unitTax) * quantity;
      if (Number.isFinite(computed) && computed > 0) {
        total = computed;
      }
    }

    if (!Number.isFinite(total) || total <= 0) {
      missingAmount += 1;
    }

    const item = {
      name: productName,
      quantity,
      total: Number.isFinite(total) ? Math.abs(total) : null,
      date: orderDate || shipDate
    };

    const order = orders.get(orderId) || {
      id: orderId,
      orderDate: orderDate || null,
      shipDate: shipDate || null,
      total: 0,
      items: []
    };
    if (!order.orderDate && orderDate) order.orderDate = orderDate;
    if (!order.shipDate && shipDate) order.shipDate = shipDate;
    order.items.push(item);
    if (Number.isFinite(item.total)) {
      order.total += item.total;
    }
    orders.set(orderId, order);
  });

  const orderEntries = Array.from(orders.values()).filter((order) => order.total > 0 && order.items.length);
  if (!orderEntries.length) {
    if (status) status.textContent = "No usable Amazon order totals found in this file.";
    return;
  }

  const amazonCandidates = state.transactions
    .filter((tx) => getFlow(tx) === FLOW.OUTFLOW && isAmazonTransaction(tx))
    .map((tx) => ({
      tx,
      key: tx.key,
      amount: Math.abs(tx.amount),
      date: getTxDate(tx)
    }))
    .filter((entry) => entry.date instanceof Date && !Number.isNaN(entry.date.valueOf()));

  if (!amazonCandidates.length) {
    if (status) status.textContent = "No Amazon-looking transactions found to enrich.";
    return;
  }

  const used = new Set();
  let matchedOrders = 0;
  let matchedItems = 0;
  let updated = 0;

  const ordersByDate = orderEntries
    .slice()
    .sort((a, b) => (b.orderDate || b.shipDate || 0) - (a.orderDate || a.shipDate || 0));
  const unmatchedOrders = [];

  ordersByDate.forEach((order) => {
    const matchDate = order.orderDate || order.shipDate || null;
    const match = findBestAmazonMatch(
      { amount: order.total, date: matchDate },
      amazonCandidates,
      used,
      { amountTolerance: 1, dateToleranceDays: 10 }
    );
    if (match) {
      const summary = buildAmazonSummary(order.items);
      setAmazonDescription(match.tx, summary);
      used.add(match.key);
      matchedOrders += 1;
      updated += 1;
    } else {
      unmatchedOrders.push(order);
    }
  });

  unmatchedOrders.forEach((order) => {
    order.items.forEach((item) => {
      if (!Number.isFinite(item.total) || item.total <= 0) return;
      const match = findBestAmazonMatch(
        { amount: item.total, date: item.date },
        amazonCandidates,
        used,
        { amountTolerance: 0.75, dateToleranceDays: 10 }
      );
      if (!match) return;
      const summary = buildAmazonItemLabel(item);
      setAmazonDescription(match.tx, summary);
      used.add(match.key);
      matchedItems += 1;
      updated += 1;
    });
  });

  if (updated) {
    saveTransactions();
    render();
  }

  if (status) {
    const unmatched = orderEntries.length - matchedOrders;
    const skipped = skippedRows + currencySkipped;
    const parts = [
      `Amazon import: ${updated} transaction(s) updated`,
      `orders matched: ${matchedOrders}`,
      `item matches: ${matchedItems}`,
      `unmatched orders: ${unmatched}`
    ];
    if (skipped) parts.push(`skipped rows: ${skipped}`);
    if (missingAmount) parts.push(`rows without totals: ${missingAmount}`);
    status.textContent = parts.join(". ") + ".";
  }
}

function makeSeededRng(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function randBetween(min, max, rng) {
  return min + (max - min) * rng();
}

function randInt(min, max, rng) {
  return Math.floor(randBetween(min, max + 1, rng));
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function toMoney(value) {
  return Math.round(value * 100) / 100;
}

function clampDay(year, monthIndex, day) {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, maxDay);
}

function makeDate(year, monthIndex, day) {
  return new Date(year, monthIndex, clampDay(year, monthIndex, day));
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function buildDemoData() {
  const rng = makeSeededRng(104729);
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  const startYear = endYear - 4;
  const transactions = [];
  const specialKeys = {};

  const accountName = "Demo Checking";
  const accountNumber = "demo-account-001";
  const defaultIban = "";
  const defaultBic = "";

  const monthLabel = (year, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const addTx = (data) => {
    const amount = toMoney(data.amount);
    if (!Number.isFinite(amount)) return null;
    const tx = {
      type: data.type || "",
      bookingDate: data.bookingDate || null,
      cardDate: data.cardDate || null,
      amount,
      payee: data.payee || "",
      iban: data.iban || "",
      bic: data.bic || "",
      purpose: data.purpose || "",
      description: data.description || "",
      accountNumber: data.accountNumber || accountNumber,
      accountName: data.accountName || accountName,
      category: data.category || "",
      cashWithdrawal: data.cashWithdrawal || ""
    };
    tx.key = buildTxKey(tx);
    transactions.push(tx);
    return tx;
  };

  const groceryPayees = [
    "REWE Supermarket",
    "EDEKA Center",
    "ALDI Nord",
    "Lidl Market",
    "DM Drogerie",
    "Rossmann"
  ];
  const diningPayees = [
    "Cafe Luna",
    "Restaurant Roma",
    "City Takeaway",
    "Burger Restaurant",
    "Sushi Cafe"
  ];
  const transportPayees = [
    "Shell Fuel",
    "Aral Fuel",
    "City Parking",
    "DB Bahn Train",
    "Uber Taxi"
  ];
  const shoppingPayees = [
    "Amazon Marketplace",
    "IKEA",
    "MediaMarkt Electronics",
    "Zalando",
    "Apple Store",
    "Bauhaus Home"
  ];
  const healthPayees = ["City Pharmacy", "Medical Clinic", "Dental Care"];
  const kidsPayees = ["Daycare Rainbow", "Kita Rainbow", "School Lunch", "Toys Planet"];
  const selfImprovementPayees = [
    "Gym Membership",
    "Udemy Course",
    "Coursera Subscription",
    "Conference Ticket"
  ];
  const travelPlans = [
    {
      city: "Barcelona",
      flight: "Lufthansa Flight Barcelona",
      stay: "Booking Hotel Barcelona",
      activity: "City Pass Barcelona"
    },
    {
      city: "Lisbon",
      flight: "TAP Flight Lisbon",
      stay: "Airbnb Lisbon",
      activity: "Tram Pass Lisbon"
    },
    {
      city: "Oslo",
      flight: "SAS Flight Oslo",
      stay: "Hotel Oslo",
      activity: "Museum Oslo"
    },
    {
      city: "Tokyo",
      flight: "ANA Flight Tokyo",
      stay: "Booking Hotel Tokyo",
      activity: "Rail Pass Tokyo"
    },
    {
      city: "Reykjavik",
      flight: "Iceland Air Flight Reykjavik",
      stay: "Airbnb Reykjavik",
      activity: "Tour Reykjavik"
    }
  ];

  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      if (year === endYear && month > endMonth) break;
      const label = monthLabel(year, month);
      const yearIndex = year - startYear;
      const seasonal = Math.sin((month / 12) * Math.PI * 2) * 120;
      const salaryBase = 4200 + yearIndex * 140;
      const salary = toMoney(salaryBase + seasonal + randBetween(-60, 110, rng));
      addTx({
        type: "Salary",
        bookingDate: makeDate(year, month, 25),
        amount: salary,
        payee: "Nordwind GmbH Payroll",
        purpose: `Salary ${label}`,
        iban: defaultIban,
        bic: defaultBic
      });

      if (month === 11) {
        addTx({
          type: "Bonus",
          bookingDate: makeDate(year, month, 20),
          amount: toMoney(900 + yearIndex * 220 + randBetween(0, 800, rng)),
          payee: "Nordwind GmbH Bonus",
          purpose: `Annual bonus ${year}`,
          iban: defaultIban,
          bic: defaultBic
        });
      }

      if (month === 3) {
        addTx({
          type: "Tax refund",
          bookingDate: makeDate(year, month, 12),
          amount: toMoney(randBetween(450, 1800, rng)),
          payee: "Tax Office Refund",
          purpose: `Tax refund ${year}`,
          iban: defaultIban,
          bic: defaultBic
        });
      }

      if (rng() < 0.3) {
        addTx({
          type: "Freelance",
          bookingDate: makeDate(year, month, randInt(10, 24, rng)),
          amount: toMoney(randBetween(350, 1400, rng)),
          payee: "Stripe Payout",
          purpose: "Freelance consulting",
          iban: defaultIban,
          bic: defaultBic
        });
      }

      const rent = toMoney(1150 + yearIndex * 25);
      addTx({
        type: "Direct Debit",
        bookingDate: makeDate(year, month, 2),
        amount: -rent,
        payee: "Oak Street Rent",
        purpose: `Rent ${label}`
      });

      const winter = [0, 1, 2, 10, 11].includes(month);
      const utilities = toMoney(140 + (winter ? 45 : -10) + randBetween(-10, 25, rng));
      addTx({
        type: "Direct Debit",
        bookingDate: makeDate(year, month, 5),
        amount: -utilities,
        payee: "Stadtwerke Energy",
        purpose: `Electricity and water ${label}`
      });

      addTx({
        type: "Direct Debit",
        bookingDate: makeDate(year, month, 8),
        amount: -49.9,
        payee: "Vodafone Internet",
        purpose: "Home internet"
      });

      addTx({
        type: "Direct Debit",
        bookingDate: makeDate(year, month, 9),
        amount: -29.9,
        payee: "Telekom Mobile Phone",
        purpose: "Mobile phone plan"
      });

      addTx({
        type: "Direct Debit",
        bookingDate: makeDate(year, month, 12),
        amount: -89.5,
        payee: "Allianz Insurance",
        purpose: "Liability insurance"
      });

      addTx({
        type: "Direct Debit",
        bookingDate: makeDate(year, month, 4),
        amount: -42.0,
        payee: "Gym Membership",
        purpose: "Monthly gym membership"
      });

      addTx({
        type: "Direct Debit",
        bookingDate: makeDate(year, month, 6),
        amount: -480.0,
        payee: "Daycare Rainbow",
        purpose: "Daycare fee"
      });

      addTx({
        type: "Direct Debit",
        bookingDate: makeDate(year, month, 16),
        amount: -400.0,
        payee: "Broker ETF Savings",
        purpose: "ETF savings plan"
      });

      addTx({
        type: "Card",
        bookingDate: makeDate(year, month, 14),
        amount: -15.99,
        payee: "Netflix",
        purpose: "Subscription"
      });

      addTx({
        type: "Card",
        bookingDate: makeDate(year, month, 15),
        amount: -10.99,
        payee: "Spotify",
        purpose: "Subscription"
      });

      addTx({
        type: "Card",
        bookingDate: makeDate(year, month, 18),
        amount: -7.99,
        payee: "Prime Video",
        purpose: "Subscription"
      });

      const groceryCount = randInt(2, 4, rng);
      for (let i = 0; i < groceryCount; i += 1) {
        const date = makeDate(year, month, randInt(2, 26, rng));
        addTx({
          type: "Card",
          bookingDate: date,
          cardDate: addDays(date, -1),
          amount: -toMoney(randBetween(30, 160, rng)),
          payee: pick(groceryPayees, rng),
          purpose: "Groceries"
        });
      }

      const diningCount = randInt(1, 3, rng);
      for (let i = 0; i < diningCount; i += 1) {
        const date = makeDate(year, month, randInt(3, 27, rng));
        addTx({
          type: "Card",
          bookingDate: date,
          cardDate: addDays(date, -1),
          amount: -toMoney(randBetween(18, 75, rng)),
          payee: pick(diningPayees, rng),
          purpose: "Restaurant"
        });
      }

      const transportCount = randInt(1, 2, rng);
      for (let i = 0; i < transportCount; i += 1) {
        const date = makeDate(year, month, randInt(4, 26, rng));
        addTx({
          type: "Card",
          bookingDate: date,
          cardDate: addDays(date, -1),
          amount: -toMoney(randBetween(35, 120, rng)),
          payee: pick(transportPayees, rng),
          purpose: "Transport"
        });
      }

      if (rng() < 0.7) {
        const date = makeDate(year, month, randInt(5, 26, rng));
        addTx({
          type: "Card",
          bookingDate: date,
          cardDate: addDays(date, -1),
          amount: -toMoney(randBetween(40, 350, rng)),
          payee: pick(shoppingPayees, rng),
          purpose: "Shopping"
        });
      }

      if (rng() < 0.25) {
        const date = makeDate(year, month, randInt(6, 27, rng));
        addTx({
          type: "Card",
          bookingDate: date,
          cardDate: addDays(date, -1),
          amount: -toMoney(randBetween(12, 95, rng)),
          payee: pick(healthPayees, rng),
          purpose: "Health"
        });
      }

      if (rng() < 0.15) {
        const date = makeDate(year, month, randInt(7, 27, rng));
        addTx({
          type: "Card",
          bookingDate: date,
          cardDate: addDays(date, -1),
          amount: -toMoney(randBetween(20, 140, rng)),
          payee: pick(selfImprovementPayees, rng),
          purpose: "Learning"
        });
      }

      if (rng() < 0.2) {
        const date = makeDate(year, month, randInt(8, 26, rng));
        addTx({
          type: "Card",
          bookingDate: date,
          cardDate: addDays(date, -1),
          amount: toMoney(randBetween(25, 220, rng)),
          payee: "Amazon Refund",
          purpose: "Refund"
        });
      }

      if ([4, 7, 11].includes(month)) {
        const trip = travelPlans[(yearIndex + month) % travelPlans.length];
        addTx({
          type: "Card",
          bookingDate: makeDate(year, month, randInt(8, 14, rng)),
          amount: -toMoney(randBetween(260, 950, rng)),
          payee: trip.flight,
          purpose: `Flight ${trip.city}`
        });
        addTx({
          type: "Card",
          bookingDate: makeDate(year, month, randInt(12, 20, rng)),
          amount: -toMoney(randBetween(420, 1600, rng)),
          payee: trip.stay,
          purpose: `Hotel ${trip.city}`
        });
        addTx({
          type: "Card",
          bookingDate: makeDate(year, month, randInt(14, 24, rng)),
          amount: -toMoney(randBetween(85, 320, rng)),
          payee: trip.activity,
          purpose: `Activities ${trip.city}`
        });
      }

      if (month === 9) {
        addTx({
          type: "Card",
          bookingDate: makeDate(year, month, randInt(10, 22, rng)),
          amount: -toMoney(randBetween(320, 980, rng)),
          payee: "Auto Maintenance",
          purpose: "Car maintenance"
        });
      }

      if (year === startYear + 1 && month === 3) {
        addTx({
          type: "Card",
          bookingDate: makeDate(year, month, 18),
          amount: -toMoney(randBetween(1800, 3200, rng)),
          payee: "IKEA Furniture",
          purpose: "Furniture upgrade"
        });
      }

      if (year === startYear + 3 && month === 6) {
        addTx({
          type: "Card",
          bookingDate: makeDate(year, month, 11),
          amount: -toMoney(randBetween(650, 1200, rng)),
          payee: "Wallbox Charging",
          purpose: "EV charger install"
        });
      }

      if (year === startYear + 2 && month === 6) {
        addTx({
          type: "Transfer",
          bookingDate: makeDate(year, month, 9),
          amount: -26000,
          payee: "Autohaus Car Purchase",
          purpose: "Car purchase"
        });
      }

      if (year === startYear + 2 && month === 1) {
        const manualExclude = addTx({
          type: "Transfer",
          bookingDate: makeDate(year, month, 13),
          amount: -950,
          payee: "Family Support",
          purpose: "One-off family support"
        });
        if (manualExclude) specialKeys.manualExclude = manualExclude.key;
      }

      if (year === startYear + 3 && month === 2) {
        const manualCategory = addTx({
          type: "Card",
          bookingDate: makeDate(year, month, 21),
          amount: -420,
          payee: "Conference Ticket",
          purpose: "Design leadership conference"
        });
        if (manualCategory) specialKeys.manualCategory = manualCategory.key;
      }

      if (rng() < 0.18) {
        const date = makeDate(year, month, randInt(6, 27, rng));
        addTx({
          type: "Card",
          bookingDate: date,
          cardDate: addDays(date, -1),
          amount: -toMoney(randBetween(18, 90, rng)),
          payee: pick(kidsPayees, rng),
          purpose: "Kids expenses"
        });
      }

      if (rng() < 0.1) {
        const date = makeDate(year, month, randInt(6, 20, rng));
        addTx({
          type: "ATM",
          bookingDate: date,
          amount: -toMoney(randBetween(40, 140, rng)),
          payee: "ATM Cash Withdrawal",
          purpose: "Cash withdrawal",
          cashWithdrawal: "yes"
        });
      }
    }
  }

  const expenseRules = [
    { keyword: "rent", category: "House" },
    { keyword: "mortgage", category: "House" },
    { keyword: "electricity", category: "House" },
    { keyword: "energy", category: "House" },
    { keyword: "water", category: "House" },
    { keyword: "internet", category: "Essential" },
    { keyword: "phone", category: "Essential" },
    { keyword: "insurance", category: "Essential" },
    { keyword: "grocery", category: "Essential" },
    { keyword: "supermarket", category: "Essential" },
    { keyword: "rewe", category: "Essential" },
    { keyword: "edeka", category: "Essential" },
    { keyword: "aldi", category: "Essential" },
    { keyword: "lidl", category: "Essential" },
    { keyword: "dm", category: "Essential" },
    { keyword: "rossmann", category: "Essential" },
    { keyword: "pharmacy", category: "Essential" },
    { keyword: "doctor", category: "Essential" },
    { keyword: "netflix", category: "Discretionary" },
    { keyword: "spotify", category: "Discretionary" },
    { keyword: "prime", category: "Discretionary" },
    { keyword: "restaurant", category: "Discretionary" },
    { keyword: "cafe", category: "Discretionary" },
    { keyword: "takeaway", category: "Discretionary" },
    { keyword: "ikea", category: "House" },
    { keyword: "bauhaus", category: "House" },
    { keyword: "furniture", category: "House" },
    { keyword: "fuel", category: "Cars" },
    { keyword: "shell", category: "Cars" },
    { keyword: "aral", category: "Cars" },
    { keyword: "parking", category: "Cars" },
    { keyword: "car wash", category: "Cars" },
    { keyword: "maintenance", category: "Cars" },
    { keyword: "train", category: "Travel" },
    { keyword: "flight", category: "Travel" },
    { keyword: "hotel", category: "Travel" },
    { keyword: "airbnb", category: "Travel" },
    { keyword: "booking", category: "Travel" },
    { keyword: "taxi", category: "Travel" },
    { keyword: "kita", category: "Kids" },
    { keyword: "daycare", category: "Kids" },
    { keyword: "school", category: "Kids" },
    { keyword: "toys", category: "Kids" },
    { keyword: "gym", category: "Self-improvement" },
    { keyword: "udemy", category: "Self-improvement" },
    { keyword: "coursera", category: "Self-improvement" },
    { keyword: "conference", category: "Self-improvement" }
  ];

  const incomeRules = [
    { keyword: "refund", category: "Discretionary" },
    { keyword: "rebate", category: "Discretionary" },
    { keyword: "cashback", category: "Discretionary" },
    { keyword: "chargeback", category: "Discretionary" }
  ];

  const demoRules = {
    ...defaultRules,
    monthsToShow: 12,
    exclusionThreshold: 15000,
    exclusionRules: [
      { id: makeRuleId(), keyword: "broker" },
      { id: makeRuleId(), keyword: "etf" },
      { id: makeRuleId(), keyword: "savings plan" }
    ],
    expenseCategoryRules: expenseRules.map((rule) => ({
      id: makeRuleId(),
      keyword: rule.keyword,
      category: rule.category
    })),
    incomeCategoryRules: incomeRules.map((rule) => ({
      id: makeRuleId(),
      keyword: rule.keyword,
      category: rule.category
    })),
    forecastNetWorthContribution: 350,
    retirementCurrentAge: 36,
    retirementAnnualGross: 68000,
    retirementExistingEP: 32
  };

  const overrides = {};
  const nowIso = new Date().toISOString();
  if (specialKeys.manualCategory) {
    overrides[specialKeys.manualCategory] = {
      category: "Self-improvement",
      exclude: false,
      updatedAt: nowIso
    };
  }
  if (specialKeys.manualExclude) {
    overrides[specialKeys.manualExclude] = {
      category: "",
      exclude: true,
      updatedAt: nowIso
    };
  }

  const recurringStreams = [
    { id: makeRecurringStreamId(), label: "Rent", keyword: "rent" },
    { id: makeRecurringStreamId(), label: "Netflix", keyword: "netflix" },
    { id: makeRecurringStreamId(), label: "Spotify", keyword: "spotify" },
    { id: makeRecurringStreamId(), label: "Gym", keyword: "gym" },
    { id: makeRecurringStreamId(), label: "Daycare", keyword: "daycare" },
    { id: makeRecurringStreamId(), label: "Insurance", keyword: "insurance" },
    { id: makeRecurringStreamId(), label: "Internet", keyword: "internet" }
  ];

    const projects = [
      {
        id: makeProjectId(),
        name: "Kitchen Remodel",
        keywords: ["ikea", "bauhaus", "furniture"],
        manualTransactions: [],
        finished: true,
        createdAt: new Date(startYear, 2, 10).toISOString()
      },
      {
        id: makeProjectId(),
        name: "Japan Trip",
        keywords: ["tokyo", "ana", "booking", "airbnb"],
        manualTransactions: [],
        finished: true,
        createdAt: new Date(startYear + 2, 4, 12).toISOString()
      },
      {
        id: makeProjectId(),
        name: "EV Upgrade",
        keywords: ["wallbox", "charging", "tesla"],
        manualTransactions: [],
        finished: false,
        createdAt: new Date(startYear + 3, 6, 8).toISOString()
      },
      {
        id: makeProjectId(),
        name: "Side Business",
        keywords: ["stripe", "freelance", "side project"],
        manualTransactions: [],
        finished: false,
        createdAt: new Date(startYear + 1, 9, 5).toISOString()
      }
    ];

  const netWorthSources = ["Cash", "Brokerage", "Retirement", "Crypto"];
  const netWorthRecords = [];
  let cash = 6500;
  let brokerage = 24000;
  let retirement = 18000;
  let crypto = 1200;

  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      if (year === endYear && month > endMonth) break;
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const cashFlow = randBetween(-800, 1200, rng);
      cash = Math.max(1500, cash + cashFlow);
      const marketReturn = randBetween(-0.02, 0.016, rng);
      const retirementReturn = randBetween(-0.01, 0.012, rng);
      const cryptoReturn = randBetween(-0.18, 0.22, rng);
      if (year === startYear + 2 && month === 2) {
        brokerage *= 0.88;
        crypto *= 0.7;
      }
      brokerage = Math.max(5000, brokerage * (1 + marketReturn) + 380);
      retirement = Math.max(4000, retirement * (1 + retirementReturn) + 220);
      crypto = Math.max(0, crypto * (1 + cryptoReturn) + randBetween(-60, 90, rng));

      netWorthRecords.push({
        id: makeNetWorthRecordId(),
        date: monthKey,
        values: {
          Cash: Math.round(cash),
          Brokerage: Math.round(brokerage),
          Retirement: Math.round(retirement),
          Crypto: Math.round(crypto)
        }
      });
    }
  }

  const netWorth = sanitizeNetWorthState({
    sources: netWorthSources,
    records: netWorthRecords
  });

  return {
    transactions,
    rules: demoRules,
    overrides,
    recurringStreams,
    archivedRecurring: {},
    projects,
    netWorth,
    summary: {
      message: `Demo data loaded: ${transactions.length} transactions (${startYear} to ${endYear}), ${projects.length} projects, ${netWorth.records.length} net worth points.`,
      startYear,
      endYear
    }
  };
}

function applyDemoData() {
  const demo = buildDemoData();
  state.transactions = demo.transactions;
  state.rules = demo.rules;
  state.overrides = demo.overrides;
  state.overrideTargetKey = null;
  state.archivedRecurring = demo.archivedRecurring;
  state.recurringStreams = demo.recurringStreams;
  state.recurringEditingId = null;
  state.projects = demo.projects;
  state.projectEditingId = null;
  state.netWorth = demo.netWorth;
  state.filters = {
    search: "",
    flow: "all",
    category: "all",
    tag: "all",
    minAmount: "",
    maxAmount: "",
    month: "all",
    showExcluded: true
  };
  saveTransactions();
  saveRules();
  saveOverrides();
  saveArchivedRecurring();
  saveRecurringStreams();
  saveProjects();
  saveNetWorth();
  return demo.summary;
}

function exportJSON() {
  const payload = buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = BACKUP_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

function getTxPurposeDisplay(tx) {
  if (!tx) return "";
  const description = (tx.description || "").toString().trim();
  if (description) {
    const normalized = normalizeString(description);
    const prefix = normalizeString(AMAZON_DESCRIPTION_PREFIX);
    if (normalized.startsWith(prefix)) {
      return description.replace(/^amazon:\s*/i, "").trim();
    }
  }
  return tx.purpose || tx.description || "";
}

function getFlow(tx) {
  if (!tx || !Number.isFinite(tx.amount)) return FLOW.ZERO;
  if (tx.amount > 0) return FLOW.INFLOW;
  if (tx.amount < 0) return FLOW.OUTFLOW;
  return FLOW.ZERO;
}

function getOperatingTransactions() {
  return state.view.analyzed;
}

function getLatestTransactionDate(transactions) {
  const dates = (transactions || [])
    .map((tx) => getTxDate(tx))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return dates.length ? dates[dates.length - 1] : null;
}

function getRecentMonthKeys(monthsBack, endDate) {
  const safeMonths = Math.max(1, Number(monthsBack) || 1);
  const anchor = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), 1) : new Date();
  const months = [];
  for (let i = safeMonths - 1; i >= 0; i -= 1) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    months.push(getMonthKey(date));
  }
  return months;
}

function getOperatingMonthlyAverages(monthsBack = 12) {
  const operatingTx = getOperatingTransactions();
  if (!operatingTx.length) {
    return {
      months: [],
      avgInflow: 0,
      avgOutflow: 0,
      totalInflow: 0,
      totalOutflow: 0
    };
  }
  const latestDate = getLatestTransactionDate(operatingTx) || new Date();
  const monthKeys = getRecentMonthKeys(monthsBack, latestDate);
  const buckets = new Map(monthKeys.map((key) => [key, { inflow: 0, outflow: 0 }]));

  operatingTx.forEach((tx) => {
    const date = getTxDate(tx);
    if (!date) return;
    const monthKey = getMonthKey(date);
    if (!buckets.has(monthKey)) return;
    const bucket = buckets.get(monthKey);
    const flow = getFlow(tx);
    if (flow === FLOW.INFLOW) bucket.inflow += tx.amount;
    if (flow === FLOW.OUTFLOW) bucket.outflow += Math.abs(tx.amount);
  });

  const totals = Array.from(buckets.values()).reduce((sum, bucket) => ({
    inflow: sum.inflow + bucket.inflow,
    outflow: sum.outflow + bucket.outflow
  }), { inflow: 0, outflow: 0 });

  const divisor = monthKeys.length || 1;
  return {
    months: monthKeys,
    avgInflow: totals.inflow / divisor,
    avgOutflow: totals.outflow / divisor,
    totalInflow: totals.inflow,
    totalOutflow: totals.outflow
  };
}

function getOperatingAnnualInflowProxy(monthsBack = 12) {
  const operatingTx = getOperatingTransactions();
  const latestDate = getLatestTransactionDate(operatingTx) || new Date();
  const monthKeys = getRecentMonthKeys(monthsBack, latestDate);
  const buckets = new Map(monthKeys.map((key) => [key, 0]));

  operatingTx.forEach((tx) => {
    const date = getTxDate(tx);
    if (!date) return;
    const monthKey = getMonthKey(date);
    if (!buckets.has(monthKey)) return;
    if (getFlow(tx) !== FLOW.INFLOW) return;
    if (isRefundTransaction(tx)) return;
    const category = sanitizeCategory(tx.category) || getDefaultCategory(tx);
    if (normalizeString(category) !== "income") return;
    buckets.set(monthKey, buckets.get(monthKey) + tx.amount);
  });

  const total = Array.from(buckets.values()).reduce((sum, value) => sum + value, 0);
  if (total > 0) return total;

  return operatingTx
    .filter((tx) => {
      const date = getTxDate(tx);
      if (!date) return false;
      if (!monthKeys.includes(getMonthKey(date))) return false;
      return getFlow(tx) === FLOW.INFLOW && !isRefundTransaction(tx);
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function isRefundTransaction(tx) {
  if (getFlow(tx) !== FLOW.INFLOW) return false;
  const category = normalizeString(sanitizeCategory(tx.category));
  return Boolean(category && category !== "income");
}

