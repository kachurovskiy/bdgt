function renderSummary() {
  const summaryBadges = el("summaryBadges");
  const summaryStats = el("summaryStats");
  summaryBadges.innerHTML = "";
  summaryStats.innerHTML = "";

  if (!state.view.derived.length) {
    summaryBadges.innerHTML = emptyState("No transactions loaded yet.");
    return;
  }

  const operatingTx = getOperatingTransactions();
  if (!operatingTx.length) {
    summaryBadges.innerHTML = emptyState("No budgeted transactions available yet.");
    return;
  }

  const excludedCount = state.view.derived.filter((tx) => tx.excluded).length;
  const dates = operatingTx
    .map((tx) => getTxDate(tx))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  const summary = {
    inflow: 0,
    outflow: 0,
    net: 0
  };

  operatingTx.forEach((tx) => {
    const flow = getFlow(tx);
    if (flow === FLOW.INFLOW) summary.inflow += tx.amount;
    if (flow === FLOW.OUTFLOW) summary.outflow += Math.abs(tx.amount);
  });

  summary.net = summary.inflow - summary.outflow;

  const periodLabel = dates.length
    ? `Period: ${formatDate(firstDate)} to ${formatDate(lastDate)}`
    : "Period: N/A";
  const badges = [
    `Budgeted: ${operatingTx.length}`,
    `Excluded: ${excludedCount}`,
    periodLabel
  ];

  badges.forEach((badge) => {
    const span = document.createElement("span");
    span.className = "badge text-bg-light border text-secondary";
    span.textContent = badge;
    summaryBadges.appendChild(span);
  });

  const stats = [
    { label: "Inflow", value: formatCurrency(summary.inflow) },
    { label: "Outflow", value: formatCurrency(summary.outflow) },
    { label: "Net", value: formatCurrency(summary.net) }
  ];

  stats.forEach((stat) => {
    const div = document.createElement("div");
    div.className = "col-12 col-md-6 col-lg-3";
    div.innerHTML = `
      <div class="border rounded-3 p-2 bg-white h-100">
        <div class="small text-muted">${stat.label}</div>
        <div class="fw-semibold">${stat.value}</div>
      </div>
    `;
    summaryStats.appendChild(div);
  });
}

const STORAGE_TEXT_ENCODER = typeof TextEncoder === "undefined" ? null : new TextEncoder();

function getStorageBytes(value) {
  if (!value) return 0;
  if (STORAGE_TEXT_ENCODER) return STORAGE_TEXT_ENCODER.encode(value).length;
  return value.length * 2;
}

function collectStorageSnapshot() {
  const entries = [];
  let totalBytes = 0;
  let totalKeys = 0;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(BACKUP_PREFIX)) continue;
    const stored = localStorage.getItem(key);
    if (stored === null) continue;
    const bytes = getStorageBytes(stored);
    entries.push({ key, bytes });
    totalBytes += bytes;
    totalKeys += 1;
  }
  return { entries, totalBytes, totalKeys };
}

function renderDatabaseOverview() {
  const statsWrap = el("dbOverviewStats");
  const tableWrap = el("dbOverviewTable");
  const status = el("dbOverviewStatus");
  if (!statsWrap || !tableWrap) return;

  const snapshot = collectStorageSnapshot();
  const bytesByKey = new Map(snapshot.entries.map((entry) => [entry.key, entry.bytes]));
  const knownKeys = new Set([
    STORAGE_KEY,
    RULES_KEY,
    OVERRIDES_KEY,
    ARCHIVED_RECURRING_KEY,
    RECURRING_STREAMS_KEY,
    PROJECTS_KEY,
    NET_WORTH_KEY
  ]);

  let otherKeys = 0;
  let otherBytes = 0;
  const otherKeyLabels = [];
  snapshot.entries.forEach((entry) => {
    if (knownKeys.has(entry.key)) return;
    otherKeys += 1;
    otherBytes += entry.bytes;
    otherKeyLabels.push(entry.key);
  });

  const transactionCount = state.transactions.length;
  const expenseRules = state.rules?.expenseCategoryRules?.length || 0;
  const incomeRules = state.rules?.incomeCategoryRules?.length || 0;
  const exclusionRules = state.rules?.exclusionRules?.length || 0;
  const exclusionAllowlist = state.rules?.exclusionAllowlist?.length || 0;
  const rulesCount = expenseRules + incomeRules + exclusionRules + exclusionAllowlist;
  const overridesCount = Object.keys(state.overrides || {}).length;
  const archivedCount = Object.keys(state.archivedRecurring || {}).length;
  const recurringCount = state.recurringStreams?.length || 0;
  const projectsCount = state.projects?.length || 0;
  const netWorthRecords = state.netWorth?.records?.length || 0;
  const netWorthSources = state.netWorth?.sources?.length || 0;
  const latestTxDate = getLatestTransactionDate(state.transactions);

  const stats = [
    { label: "Stored keys", value: snapshot.totalKeys.toLocaleString("en-GB") },
    { label: "Total size", value: formatBytes(snapshot.totalBytes) },
    { label: "Transactions", value: transactionCount.toLocaleString("en-GB") },
    { label: "Latest transaction", value: latestTxDate ? formatDate(latestTxDate) : "N/A" }
  ];

  statsWrap.innerHTML = "";
  stats.forEach((stat) => {
    const div = document.createElement("div");
    div.className = "col-12 col-md-6 col-lg-3";
    div.innerHTML = `
      <div class="border rounded-3 p-2 bg-white h-100">
        <div class="small text-muted">${safeText(stat.label)}</div>
        <div class="fw-semibold">${safeText(stat.value)}</div>
      </div>
    `;
    statsWrap.appendChild(div);
  });

  const buildRow = ({ label, count, bytes, stored, detail }) => {
    const countLabel = Number.isFinite(count)
      ? count.toLocaleString("en-GB")
      : safeText(count || "0");
    const sizeLabel = stored ? formatBytes(bytes || 0) : "N/A";
    const detailHtml = detail ? `<div class="small text-muted">${safeText(detail)}</div>` : "";
    return `
      <tr>
        <td>${safeText(label)}</td>
        <td>
          <div class="fw-semibold">${countLabel}</div>
          ${detailHtml}
        </td>
        <td class="text-muted">${safeText(sizeLabel)}</td>
      </tr>
    `;
  };

  const rows = [
    buildRow({
      label: "Transactions",
      count: transactionCount,
      bytes: bytesByKey.get(STORAGE_KEY),
      stored: bytesByKey.has(STORAGE_KEY)
    }),
    buildRow({
      label: "Rules",
      count: rulesCount,
      bytes: bytesByKey.get(RULES_KEY),
      stored: bytesByKey.has(RULES_KEY),
      detail: rulesCount
        ? `${expenseRules} expense, ${incomeRules} income, ${exclusionRules} exclusion, ${exclusionAllowlist} allowlist`
        : ""
    }),
    buildRow({
      label: "Overrides",
      count: overridesCount,
      bytes: bytesByKey.get(OVERRIDES_KEY),
      stored: bytesByKey.has(OVERRIDES_KEY)
    }),
    buildRow({
      label: "Recurring streams",
      count: recurringCount,
      bytes: bytesByKey.get(RECURRING_STREAMS_KEY),
      stored: bytesByKey.has(RECURRING_STREAMS_KEY)
    }),
    buildRow({
      label: "Archived recurring",
      count: archivedCount,
      bytes: bytesByKey.get(ARCHIVED_RECURRING_KEY),
      stored: bytesByKey.has(ARCHIVED_RECURRING_KEY)
    }),
    buildRow({
      label: "Projects",
      count: projectsCount,
      bytes: bytesByKey.get(PROJECTS_KEY),
      stored: bytesByKey.has(PROJECTS_KEY)
    }),
    buildRow({
      label: "Net worth",
      count: netWorthRecords,
      bytes: bytesByKey.get(NET_WORTH_KEY),
      stored: bytesByKey.has(NET_WORTH_KEY),
      detail: netWorthSources ? `${netWorthSources} sources` : ""
    })
  ];

  if (otherKeys > 0) {
    const preview = otherKeyLabels.slice(0, 3);
    const suffix = otherKeyLabels.length > 3
      ? ` +${otherKeyLabels.length - 3} more`
      : "";
    const detail = preview.length ? `Keys: ${preview.join(", ")}${suffix}` : "";
    rows.push(buildRow({
      label: "Other settings",
      count: `${otherKeys} key${otherKeys === 1 ? "" : "s"}`,
      bytes: otherBytes,
      stored: true,
      detail
    }));
  }

  tableWrap.innerHTML = rows.length
    ? buildTable(["Store", "Items", "Size"], rows.join(""), { tableClass: "small" })
    : emptyState("No local data yet.");

  if (status) {
    status.textContent = snapshot.totalKeys
      ? `${snapshot.totalKeys} key${snapshot.totalKeys === 1 ? "" : "s"} · ${formatBytes(snapshot.totalBytes)}`
      : "No local data yet.";
  }
}

function collectRuleHitCounts() {
  const expenseRules = state.rules.expenseCategoryRules || [];
  const incomeRules = state.rules.incomeCategoryRules || [];
  const exclusionRules = state.rules.exclusionRules || [];
  const exclusionAllowlist = state.rules.exclusionAllowlist || [];

  const expenseCounts = new Map(expenseRules.map((rule) => [rule.id, 0]));
  const incomeCounts = new Map(incomeRules.map((rule) => [rule.id, 0]));
  const exclusionCounts = new Map(exclusionRules.map((rule) => [rule.id, 0]));
  const allowlistKeywords = exclusionAllowlist
    .map((rule) => normalizeString(rule.keyword))
    .filter(Boolean);

  if (!state.transactions.length) {
    return { expenseCounts, incomeCounts, exclusionCounts };
  }

  state.transactions.forEach((tx) => {
    const haystack = normalizeString([tx.payee, tx.purpose, tx.description].join(" "));
    const useIncomeRules = tx.amount > 0;
    const categoryRules = useIncomeRules ? incomeRules : expenseRules;
    const categoryCounts = useIncomeRules ? incomeCounts : expenseCounts;

    for (const rule of categoryRules) {
      const keyword = normalizeString(rule.keyword);
      if (!keyword) continue;
      if (haystack.includes(keyword)) {
        categoryCounts.set(rule.id, (categoryCounts.get(rule.id) || 0) + 1);
        break;
      }
    }

    const allowlistHit = allowlistKeywords.length
      && allowlistKeywords.some((keyword) => haystack.includes(keyword));
    if (allowlistHit) return;

    for (const rule of exclusionRules) {
      const keyword = normalizeString(rule.keyword);
      if (!keyword) continue;
      if (haystack.includes(keyword)) {
        exclusionCounts.set(rule.id, (exclusionCounts.get(rule.id) || 0) + 1);
        break;
      }
    }
  });

  return { expenseCounts, incomeCounts, exclusionCounts };
}

function renderRuleTable(wrapId, rules, emptyMessage, removeAction, hitCounts = new Map()) {
  const wrap = el(wrapId);
  if (!wrap) return;
  if (!rules.length) {
    wrap.innerHTML = emptyState(emptyMessage);
    return;
  }

  const rows = rules
    .map((rule) => `
      <tr>
        <td>${safeText(rule.keyword)}</td>
        <td>${safeText(rule.category)}</td>
        <td class="text-muted">${(hitCounts.get(rule.id) || 0).toLocaleString("en-GB")}</td>
        <td><button class="btn btn-sm btn-outline-secondary" data-action="${removeAction}" data-id="${rule.id}">Remove</button></td>
      </tr>
    `)
    .join("");

  wrap.innerHTML = `
    ${buildTable(["Keyword", "Category", "Matches", "Action"], rows)}
  `;
}

function renderExpenseRuleTable(hitCounts = new Map()) {
  renderRuleTable(
    "expenseRuleTableWrap",
    state.rules.expenseCategoryRules || [],
    "No expense auto-categorization rules yet.",
    "remove-expense-rule",
    hitCounts
  );
}

function renderIncomeRuleTable(hitCounts = new Map()) {
  renderRuleTable(
    "incomeRuleTableWrap",
    state.rules.incomeCategoryRules || [],
    "No incoming auto-categorization rules yet.",
    "remove-income-rule",
    hitCounts
  );
}

function renderExclusionRuleTable(hitCounts = new Map()) {
  const wrap = el("exclusionRuleTableWrap");
  if (!wrap) return;
  const rules = state.rules.exclusionRules || [];
  if (!rules.length) {
    wrap.innerHTML = emptyState("No exclusion rules yet.");
    return;
  }
  const rows = rules
    .map((rule) => `
      <tr>
        <td>${safeText(rule.keyword)}</td>
        <td class="text-muted">${(hitCounts.get(rule.id) || 0).toLocaleString("en-GB")}</td>
        <td>
          <button class="btn btn-sm btn-outline-secondary" data-action="remove-exclusion-rule" data-id="${rule.id}">
            Remove
          </button>
        </td>
      </tr>
    `)
    .join("");
  wrap.innerHTML = buildTable(["Keyword", "Matches", "Action"], rows);
}

function renderExclusionAllowlist() {
  const wrap = el("exclusionAllowTableWrap");
  if (!wrap) return;
  const rules = state.rules.exclusionAllowlist || [];
  if (!rules.length) {
    wrap.innerHTML = emptyState("No allowlist terms yet.");
    return;
  }
  const rows = rules
    .map((rule) => `
      <tr>
        <td>${safeText(rule.keyword)}</td>
        <td>
          <button class="btn btn-sm btn-outline-secondary" data-action="remove-exclusion-allow" data-id="${rule.id}">
            Remove
          </button>
        </td>
      </tr>
    `)
    .join("");
  wrap.innerHTML = buildTable(["Keyword", "Action"], rows);
}

function renderOverridesTable() {
  const wrap = el("overrideTableWrap");
  const entries = Object.entries(state.overrides || {});
  if (!entries.length) {
    wrap.innerHTML = emptyState("No manual overrides yet.");
    return;
  }

  const rows = entries
    .map(([key, override]) => {
      const tx = state.view.derived.find((item) => item.key === key);
      const date = tx ? formatDate(getTxDate(tx)) : "N/A";
      const label = tx ? (tx.payee || tx.purpose || tx.description || "N/A") : "Unknown transaction";
      const amount = tx ? formatCurrency(tx.amount) : "N/A";
      const category = override.category || (tx ? tx.category : "N/A");
      const excludeLabel = override.exclude ? "Yes" : "No";
      return `
        <tr>
          <td>${date}</td>
          <td>${safeText(label)}</td>
          <td>${safeText(category)}</td>
          <td>${excludeLabel}</td>
          <td>${amount}</td>
          <td>
            <button class="btn btn-sm btn-outline-secondary me-1" data-action="edit-override" data-key="${key}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-action="remove-override" data-key="${key}">Remove</button>
          </td>
        </tr>
      `;
    })
    .join("");

  wrap.innerHTML = `
    ${buildTable(
      ["Date", "Payee/Purpose", "Category", "Excluded", "Amount", "Action"],
      rows
    )}
  `;
}

function syncRecurringFormState() {
  const button = el("saveRecurringStreamBtn");
  if (!button) return;
  button.textContent = state.recurringEditingId ? "Update stream" : "Add stream";
}

function setRecurringForm(stream) {
  if (!stream) return;
  el("recurringLabel").value = stream.label || "";
  el("recurringKeyword").value = stream.keyword || "";
  state.recurringEditingId = stream.id || null;
  syncRecurringFormState();
  renderRecurringPreview();
}

function clearRecurringForm() {
  state.recurringEditingId = null;
  el("recurringLabel").value = "";
  el("recurringKeyword").value = "";
  syncRecurringFormState();
  renderRecurringPreview();
}

function renderRecurringPreview() {
  const wrap = el("recurringPreview");
  if (!wrap) return;
  const keyword = (el("recurringKeyword")?.value || "").trim();
  if (!keyword) {
    wrap.innerHTML = emptyState("Enter a keyword to preview matching expenses.");
    return;
  }

  const matches = getRecurringStreamMatches({ keyword }, state.view.analyzed)
    .sort((a, b) => {
      const dateA = getTxDate(a);
      const dateB = getTxDate(b);
      return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
    });
  if (!matches.length) {
    wrap.innerHTML = emptyState("No matching expenses found.");
    return;
  }

  const total = matches.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const rows = matches
    .slice(0, 6)
    .map((tx) => `
      <tr>
        <td>${formatDate(getTxDate(tx))}</td>
        <td>${safeText(tx.payee || tx.purpose || tx.description || "N/A")}</td>
        <td>${safeText(tx.category || "Discretionary")}</td>
        <td class="text-danger fw-semibold">${formatCurrency(tx.amount)}</td>
      </tr>
    `)
    .join("");

  wrap.innerHTML = `
    <div class="small text-muted mb-2">Matches: ${matches.length} &middot; Total: ${formatCurrency(total)}</div>
    ${buildTable(["Date", "Payee/Purpose", "Category", "Amount"], rows)}
  `;
}

function renderRecurringStreamsTable() {
  const wrap = el("recurringStreamsTable");
  if (!wrap) return;
  const streams = state.recurringStreams || [];
  if (!streams.length) {
    wrap.innerHTML = emptyState("No recurring streams yet.");
    return;
  }

  const year = new Date().getFullYear();
  const txs = state.view.analyzed;
  const entries = streams
    .map((stream) => ({
      stream,
      current: buildRecurringStreamStats(stream, year, txs),
      previous: buildRecurringStreamStats(stream, year - 1, txs)
    }))
    .sort((a, b) => {
      if (b.current.total !== a.current.total) return b.current.total - a.current.total;
      return b.current.count - a.current.count;
    });

  const rows = entries
    .map(({ stream, current, previous }) => {
      const currentLabel = current.count
        ? `${current.count} &middot; ${formatCurrency(current.total)}`
        : "&mdash;";
      const previousLabel = previous.count
        ? `${previous.count} &middot; ${formatCurrency(previous.total)}`
        : "&mdash;";
      return `
        <tr>
          <td>${safeText(stream.label)}</td>
          <td>${safeText(stream.keyword)}</td>
          <td>${currentLabel}</td>
          <td>${previousLabel}</td>
          <td>
            <button class="btn btn-sm btn-outline-secondary me-1" data-action="edit-recurring" data-id="${stream.id}">Edit</button>
            <button class="btn btn-sm btn-outline-secondary me-1" data-action="preview-recurring" data-id="${stream.id}">Preview</button>
            <button class="btn btn-sm btn-outline-danger" data-action="remove-recurring" data-id="${stream.id}">Remove</button>
          </td>
        </tr>
      `;
    })
    .join("");

  wrap.innerHTML = buildTable(
    ["Stream", "Keyword", `${year}`, `${year - 1}`, "Action"],
    rows
  );
}

function buildRecurringStreamMonthlyTotals(stream, year, transactions) {
  const totals = Array.from({ length: 12 }, () => 0);
  const matches = getRecurringStreamMatches(stream, transactions)
    .filter((tx) => {
      const date = getTxDate(tx);
      return date && date.getFullYear() === year;
    });
  matches.forEach((tx) => {
    const date = getTxDate(tx);
    if (!date) return;
    totals[date.getMonth()] += Math.abs(tx.amount);
  });
  return totals;
}

function buildSparkline(values) {
  if (!values || !values.length) return '<span class="text-muted">&mdash;</span>';
  const maxValue = Math.max(...values);
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return '<span class="text-muted">&mdash;</span>';
  }
  const width = 120;
  const height = 28;
  const padding = 2;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const lastIndex = values.length - 1;
  const points = values
    .map((value, index) => {
      const x = padding + innerWidth * (lastIndex ? index / lastIndex : 0);
      const y = padding + innerHeight * (1 - value / maxValue);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return `
    <svg class="bdgt-sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <line class="bdgt-sparkline-axis" x1="0" y1="${height - 1}" x2="${width}" y2="${height - 1}"></line>
      <polyline class="bdgt-sparkline-line" points="${points}"></polyline>
    </svg>
  `;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function median(values) {
  if (!values || !values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getMedianAmount(matches) {
  const values = (matches || [])
    .map((match) => Math.abs(match.tx.amount))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2
    ? values[mid]
    : (values[mid - 1] + values[mid]) / 2;
}

function buildRecurringCadenceInfo(matches, asOfDate) {
  const dates = (matches || []).map((match) => match.date).filter(Boolean);
  if (!dates.length) {
    return {
      cadenceDays: null,
      baselineCadence: null,
      cadenceBreak: false,
      lastDate: null,
      daysSinceLast: null
    };
  }
  const intervals = [];
  for (let i = 1; i < dates.length; i += 1) {
    const delta = (dates[i] - dates[i - 1]) / MS_PER_DAY;
    if (delta > 0) intervals.push(delta);
  }
  const cadenceDays = intervals.length ? median(intervals) : null;
  const baselineCadence = intervals.length >= 3
    ? median(intervals.slice(0, -1))
    : intervals.length >= 2
      ? median(intervals)
      : null;
  const lastDate = dates[dates.length - 1];
  const daysSinceLast = lastDate ? (asOfDate - lastDate) / MS_PER_DAY : null;
  const lastInterval = intervals.length ? intervals[intervals.length - 1] : null;
  const threshold = baselineCadence ? Math.max(baselineCadence * 1.6, 10) : null;
  const cadenceBreak = Boolean(
    baselineCadence
    && threshold
    && (
      (lastInterval && lastInterval > threshold)
      || (daysSinceLast && daysSinceLast > threshold)
    )
  );

  return {
    cadenceDays,
    baselineCadence,
    cadenceBreak,
    lastDate,
    daysSinceLast
  };
}

function buildRecurringProjection({
  yearTotal,
  matchesYear,
  cadence,
  typicalAmount,
  year,
  asOfDate,
  projectionCadence
}) {
  const isCurrentYear = year === asOfDate.getFullYear();
  if (!isCurrentYear) {
    return { projectedTotal: yearTotal, projectedRemaining: 0, method: "actual" };
  }
  if (cadence.cadenceBreak) {
    return { projectedTotal: yearTotal, projectedRemaining: 0, method: "stale" };
  }

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const cadenceDays = projectionCadence?.baselineCadence
    || projectionCadence?.cadenceDays
    || cadence.baselineCadence
    || cadence.cadenceDays;
  const cadenceLastDate = projectionCadence?.lastDate || cadence.lastDate;

  if (cadenceDays && cadenceLastDate && typicalAmount > 0) {
    let nextDate = new Date(cadenceLastDate.getTime() + cadenceDays * MS_PER_DAY);
    let count = 0;
    while (nextDate <= yearEnd) {
      count += 1;
      nextDate = new Date(nextDate.getTime() + cadenceDays * MS_PER_DAY);
    }
    const projectedRemaining = count * typicalAmount;
    return {
      projectedTotal: yearTotal + projectedRemaining,
      projectedRemaining,
      method: "cadence"
    };
  }

  if (matchesYear.length >= 2) {
    const daysElapsed = Math.max(1, (asOfDate - yearStart) / MS_PER_DAY);
    const daysRemaining = Math.max(0, (yearEnd - asOfDate) / MS_PER_DAY);
    const dailyRate = yearTotal / daysElapsed;
    const projectedRemaining = dailyRate * daysRemaining;
    return {
      projectedTotal: yearTotal + projectedRemaining,
      projectedRemaining,
      method: "runrate"
    };
  }

  return { projectedTotal: yearTotal, projectedRemaining: 0, method: "none" };
}

function buildRecurringYearEntry(stream, year, transactions, asOfDate, options = {}) {
  const matches = getRecurringStreamMatches(stream, transactions)
    .map((tx) => ({
      tx,
      date: getTxDate(tx)
    }))
    .filter((match) => match.date)
    .sort((a, b) => a.date - b.date);

  const matchesYear = matches.filter((match) => match.date.getFullYear() === year);
  const yearTotal = matchesYear.reduce((sum, match) => sum + Math.abs(match.tx.amount), 0);
  const lastDate = matchesYear.length ? matchesYear[matchesYear.length - 1].date : null;
  const cadence = buildRecurringCadenceInfo(matches, asOfDate);
  const useBaselineYear = Number.isFinite(options.projectionBaselineYear)
    && options.projectionBaselineYear !== year;
  const projectionMatches = useBaselineYear
    ? matches.filter((match) => match.date.getFullYear() === options.projectionBaselineYear)
    : [];
  const projectionSample = projectionMatches.length
    ? projectionMatches
    : matchesYear.length
      ? matchesYear
      : matches;
  let projectionCadence = null;
  if (projectionMatches.length) {
    const projectionCadenceInfo = buildRecurringCadenceInfo(projectionSample, asOfDate);
    projectionCadence = {
      cadenceDays: projectionCadenceInfo.cadenceDays,
      baselineCadence: projectionCadenceInfo.baselineCadence,
      lastDate: lastDate || projectionCadenceInfo.lastDate
    };
  }
  const recentMatches = projectionSample.slice(-6);
  const typicalAmount = getMedianAmount(recentMatches);
  const projection = buildRecurringProjection({
    yearTotal,
    matchesYear,
    cadence,
    typicalAmount,
    year,
    asOfDate,
    projectionCadence
  });

  return {
    stream,
    stats: {
      count: matchesYear.length,
      total: yearTotal,
      lastDate
    },
    cadence,
    projection
  };
}

function renderRecurringYearTable(wrapId, year, emptyText, options = {}) {
  const wrap = el(wrapId);
  if (!wrap) return;
  const streams = state.recurringStreams || [];
  if (!streams.length) {
    wrap.innerHTML = emptyState(emptyText);
    return;
  }

  const txs = state.view.analyzed;
  const { includeProjection = false, projectionBaselineYear = null } = options;
  const asOfDate = new Date();
  const isCurrentYear = year === asOfDate.getFullYear();
  const includePausedWithoutMatches = includeProjection && !isCurrentYear;
  const entries = streams
    .map((stream) => buildRecurringYearEntry(stream, year, txs, asOfDate, { projectionBaselineYear }))
    .filter((entry) => entry.stats.count || (includePausedWithoutMatches && entry.cadence.cadenceBreak))
    .sort((a, b) => b.stats.total - a.stats.total);

  const rows = entries
    .map(({ stream, stats, cadence, projection }) => {
      const monthlyTotals = buildRecurringStreamMonthlyTotals(stream, year, txs);
      const sparkline = buildSparkline(monthlyTotals);
      const hasMatches = stats.count > 0;
      const totalLabel = hasMatches ? formatCurrency(stats.total) : "&mdash;";
      const lastSeen = stats.lastDate || cadence.lastDate;
      const lastLabel = lastSeen ? formatDate(lastSeen) : "N/A";
      let projectionLine = "";
      if (includeProjection) {
        if (projection.method === "cadence" || projection.method === "runrate") {
          projectionLine = `<div class="small text-muted">Proj ${formatCurrency(projection.projectedTotal)}</div>`;
        } else if (projection.method === "stale") {
          projectionLine = `<div class="small text-warning">Proj paused</div>`;
        }
      }
      const cadenceBadge = cadence.cadenceBreak
        ? '<span class="badge text-bg-warning ms-2">Cadence break</span>'
        : "";
      return `
        <tr>
          <td>${safeText(stream.label)}</td>
          <td>${hasMatches ? stats.count : "&mdash;"}</td>
          <td class="text-danger fw-semibold">${totalLabel}${projectionLine}</td>
          <td>${sparkline}</td>
          <td>${lastLabel}${cadenceBadge}</td>
        </tr>
      `;
    })
    .join("");

  if (!rows) {
    wrap.innerHTML = emptyState(emptyText);
    return;
  }

  let summaryHtml = "";
  if (includeProjection) {
    const yearTotalSum = entries.reduce((sum, entry) => sum + entry.stats.total, 0);
    const projectedTotalSum = entries.reduce(
      (sum, entry) => sum + (entry.projection?.projectedTotal ?? entry.stats.total),
      0
    );
    const cadenceBreaks = entries.filter((entry) => entry.cadence.cadenceBreak).length;
    const baselineNote = Number.isFinite(projectionBaselineYear) && projectionBaselineYear !== year
      ? `Projection uses ${projectionBaselineYear} cadence when available; cadence breaks are not extrapolated.`
      : "Projection uses observed cadence; cadence breaks are not extrapolated.";
    summaryHtml = `
      <div class="d-flex flex-wrap gap-3 align-items-center small text-muted mb-1">
        <div><span class="fw-semibold text-dark">YTD total:</span> ${formatCurrency(yearTotalSum)}</div>
        <div><span class="fw-semibold text-dark">Projected full-year:</span> ${formatCurrency(projectedTotalSum)}</div>
        ${cadenceBreaks ? `<div class="text-warning">Cadence breaks: ${cadenceBreaks}</div>` : ""}
      </div>
      <div class="small text-muted mb-3">${baselineNote}</div>
    `;
  }

  wrap.innerHTML = `
    ${summaryHtml}
    ${buildTable(
      ["Stream", "Matches", "Year Total", "Trend", "Last"],
      rows
    )}
  `;
}

function renderRecurring() {
  syncRecurringFormState();
  renderRecurringPreview();
  renderRecurringStreamsTable();
  const currentYear = new Date().getFullYear();
  renderRecurringYearTable(
    "recurringExpenses",
    currentYear,
    "No recurring expense streams matched this year yet.",
    { includeProjection: true, projectionBaselineYear: currentYear - 1 }
  );
  renderRecurringYearTable(
    "archivedRecurring",
    currentYear - 1,
    "No recurring expense streams matched last year yet."
  );
}

function syncProjectFormState() {
  const button = el("saveProjectBtn");
  if (!button) return;
  button.textContent = state.projectEditingId ? "Update project" : "Add project";
}

function setProjectForm(project) {
  if (!project) return;
  el("projectName").value = project.name || "";
  el("projectKeywords").value = (project.keywords || []).join(", ");
  el("projectFinished").checked = Boolean(project.finished);
  state.projectEditingId = project.id || null;
  syncProjectFormState();
}

function clearProjectForm() {
  state.projectEditingId = null;
  el("projectName").value = "";
  el("projectKeywords").value = "";
  el("projectFinished").checked = false;
  syncProjectFormState();
}

function buildProjectStats(project, entries = null) {
  const matches = (entries || getProjectMatches(project, state.view.derived)
    .map((tx) => ({
      tx,
      date: getTxDate(tx)
    })))
    .filter((entry) => entry.date instanceof Date && !Number.isNaN(entry.date.valueOf()))
    .sort((a, b) => a.date - b.date);

  if (!matches.length) {
    return {
      count: 0,
      inflow: 0,
      outflow: 0,
      net: 0,
      firstDate: null,
      lastDate: null,
      labels: [],
      values: []
    };
  }

  let inflow = 0;
  let outflow = 0;
  const monthBuckets = new Map();

  matches.forEach(({ tx, date }) => {
    const flow = getFlow(tx);
    if (flow === FLOW.INFLOW) inflow += tx.amount;
    if (flow === FLOW.OUTFLOW) outflow += Math.abs(tx.amount);
    const monthKey = getMonthKey(date);
    if (!monthKey) return;
    monthBuckets.set(monthKey, (monthBuckets.get(monthKey) || 0) + tx.amount);
  });

  const months = Array.from(monthBuckets.keys()).sort();
  let cumulative = 0;
  const labels = [];
  const values = [];
  months.forEach((monthKey) => {
    cumulative += monthBuckets.get(monthKey) || 0;
    labels.push(formatMonthLabel(monthKey));
    values.push(cumulative);
  });

  return {
    count: matches.length,
    inflow,
    outflow,
    net: inflow - outflow,
    firstDate: matches[0].date,
    lastDate: matches[matches.length - 1].date,
    labels,
    values
  };
}

function makeFadedColor(color) {
  if (!color || typeof color !== "string") return color;
  const match = color.match(/rgba\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([0-9.]+)\)/);
  if (!match) return color;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, 0.15)`;
}

function renderProjectTxSearchResults(projectId, query) {
  const wrap = el(`projectTxResults-${projectId}`);
  if (!wrap) return;
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    wrap.innerHTML = emptyState("Project not found.");
    return;
  }

  const trimmed = (query || "").trim();
  if (!trimmed) {
    wrap.innerHTML = '<div class="text-muted small">Type to search transactions.</div>';
    return;
  }
  const normalized = normalizeString(trimmed);
  if (normalized.length < 2) {
    wrap.innerHTML = '<div class="text-muted small">Type at least 2 characters.</div>';
    return;
  }
  if (!state.view.derived.length) {
    wrap.innerHTML = emptyState("No transactions loaded yet.");
    return;
  }

  const manualKeys = new Set(normalizeTransactionKeyList(project.manualTransactions));
  const matches = state.view.derived
    .filter((tx) => {
      const haystack = normalizeString([tx.payee, tx.category, tx.purpose, tx.description].join(" "));
      return haystack.includes(normalized);
    })
    .sort((a, b) => getTxDate(b) - getTxDate(a))
    .slice(0, 8);

  if (!matches.length) {
    wrap.innerHTML = '<div class="text-muted small">No matching transactions.</div>';
    return;
  }

  const rows = matches
    .map((tx) => {
      const date = getTxDate(tx);
      const dateLabel = date ? formatDate(date) : "N/A";
      const payee = tx.payee || "N/A";
      const purpose = getTxPurposeDisplay(tx) || "N/A";
      const amount = formatCurrency(tx.amount);
      const flow = getFlow(tx);
      const amountClass = flow === FLOW.INFLOW
        ? "text-success fw-semibold"
        : flow === FLOW.OUTFLOW
          ? "text-danger fw-semibold"
          : "fw-semibold";
      const excludedBadge = tx.excluded ? '<span class="badge text-bg-warning">Excluded</span>' : "";
      const isPinned = manualKeys.has(tx.key);
      const action = isPinned ? "remove-project-tx" : "add-project-tx";
      const actionLabel = isPinned ? "Remove" : "Add";
      const actionClass = isPinned ? "btn-outline-danger" : "btn-outline-primary";

      return `
        <div class="list-group-item d-flex flex-wrap gap-2 align-items-center">
          <div class="flex-grow-1">
            <div class="fw-semibold">${dateLabel} · ${safeText(payee)}</div>
            <div class="text-muted small">${safeText(purpose)}</div>
          </div>
          <div class="text-end">
            <div class="${amountClass}">${amount}</div>
            ${excludedBadge}
          </div>
          <button
            class="btn btn-sm ${actionClass}"
            data-action="${action}"
            data-project-id="${project.id}"
            data-key="${tx.key}"
          >
            ${actionLabel}
          </button>
        </div>
      `;
    })
    .join("");

  wrap.innerHTML = `<div class="list-group list-group-flush">${rows}</div>`;
}

function renderProjects() {
  const wrap = el("projectsWrap");
  if (!wrap) return;

  syncProjectFormState();

  if (!state.projects || !state.projects.length) {
    wrap.innerHTML = emptyState("No projects yet.");
    return;
  }

  const charts = [];
  const cards = state.projects.map((project, index) => {
    const entries = getProjectMatches(project, state.view.derived)
      .map((tx) => ({
        tx,
        date: getTxDate(tx)
      }))
      .filter((entry) => entry.date instanceof Date && !Number.isNaN(entry.date.valueOf()))
      .sort((a, b) => a.date - b.date);
    const stats = buildProjectStats(project, entries);
    const cutoff = new Date(Date.now() - 365 * MS_PER_DAY);
    const recentEntries = entries
      .filter((entry) => entry.date >= cutoff)
      .sort((a, b) => b.date - a.date);
    const chartId = `projectChart-${project.id}`;
    const isFinished = Boolean(project.finished);
    const statusLabel = isFinished ? "Finished" : "Ongoing";
    const statusClass = isFinished ? "text-bg-secondary" : "text-bg-success";
    const color = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
    const manualCount = normalizeTransactionKeyList(project.manualTransactions).length;
    const manualLabel = manualCount
      ? `${manualCount} pinned transaction${manualCount === 1 ? "" : "s"}`
      : "No pinned transactions yet.";
    const queryId = `projectTxQuery-${project.id}`;
    const resultsId = `projectTxResults-${project.id}`;

    if (stats.labels.length) {
      charts.push({
        id: chartId,
        labels: stats.labels,
        values: stats.values,
        color
      });
    }

    const statsLabel = stats.count
      ? `
        <div class="small text-muted">Transactions</div>
        <div class="fw-semibold">${stats.count}</div>
      `
      : `<div class="text-muted small">No matching transactions yet.</div>`;

    const period = stats.count
      ? `${formatDate(stats.firstDate)} to ${formatDate(stats.lastDate)}`
      : "N/A";

    const footerSummary = stats.count
      ? `
        <div class="d-flex flex-wrap gap-3 align-items-center small text-muted">
          <span>Tracked since ${formatDate(stats.firstDate)}</span>
          <span>Last 365 days: ${recentEntries.length} tx</span>
        </div>
      `
      : `
        <div class="d-flex flex-wrap gap-3 align-items-center small text-muted">
          <span>No matching transactions yet.</span>
          <span>Last 365 days: 0 tx</span>
        </div>
      `;

    const recentRows = recentEntries
      .map(({ tx, date }) => {
        const flow = getFlow(tx);
        const amountClass = flow === FLOW.INFLOW
          ? "text-success fw-semibold"
          : flow === FLOW.OUTFLOW
            ? "text-danger fw-semibold"
            : "fw-semibold";
        const flowLabel = flow === FLOW.INFLOW
          ? "Inflow"
          : flow === FLOW.OUTFLOW
            ? "Outflow"
            : "Zero";
        const payee = tx.payee || "N/A";
        const purpose = getTxPurposeDisplay(tx) || "N/A";
        const excludedBadge = tx.excluded ? ' <span class="badge text-bg-warning">Excluded</span>' : "";
        return `
          <tr data-key="${tx.key}">
            <td>${formatDate(date)}</td>
            <td>${safeText(payee)}${excludedBadge}</td>
            <td class="text-muted">${safeText(purpose)}</td>
            <td>${flowLabel}</td>
            <td class="${amountClass}">${formatCurrency(tx.amount)}</td>
          </tr>
        `;
      })
      .join("");

    const recentTable = recentEntries.length
      ? buildTable(["Date", "Payee", "Purpose", "Flow", "Amount"], recentRows, { tableClass: "small" })
      : emptyState("No project transactions in the last 365 days.");

    const recentSection = recentEntries.length && recentEntries.length > 10
      ? `<div class="project-tx-scroll">${recentTable}</div>`
      : recentTable;

    return `
      <div class="card shadow-sm">
        <div class="card-header d-flex flex-wrap gap-2 align-items-center">
          <div class="flex-grow-1">
            <h3 class="h6 mb-1">${safeText(project.name)}</h3>
            <div class="text-muted small">Keywords: ${safeText((project.keywords || []).join(", "), "None")}</div>
          </div>
          <span class="badge ${statusClass}">${statusLabel}</span>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-project" data-id="${project.id}">Edit</button>
            <button class="btn btn-sm btn-outline-primary" data-action="toggle-project" data-id="${project.id}">
              ${isFinished ? "Reopen" : "Mark finished"}
            </button>
            <button class="btn btn-sm btn-outline-danger" data-action="remove-project" data-id="${project.id}">Remove</button>
          </div>
        </div>
        <div class="card-body d-flex flex-column gap-3">
          <div class="row g-3 align-items-center">
            <div class="col-12 col-lg-4">
              <div class="border rounded-3 p-2 bg-light h-100">
                <div class="small text-muted">Period</div>
                <div class="fw-semibold">${period}</div>
                <div class="mt-2">${statsLabel}</div>
                <div class="small text-muted mt-2">Inflow</div>
                <div class="fw-semibold text-success">${formatCurrency(stats.inflow)}</div>
                <div class="small text-muted mt-2">Outflow</div>
                <div class="fw-semibold text-danger">${formatCurrency(stats.outflow)}</div>
                <div class="small text-muted mt-2">Net</div>
                <div class="fw-semibold">${formatCurrency(stats.net)}</div>
              </div>
            </div>
            <div class="col-12 col-lg-8">
              ${stats.labels.length
    ? `<canvas id="${chartId}" height="70"></canvas>`
    : `<div class="text-muted small">No chart yet. Add transactions that match the keywords.</div>`
  }
            </div>
          </div>
          <div class="border rounded-3 p-2 bg-white">
            <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
              <h4 class="h6 mb-0 flex-grow-1">Add transaction</h4>
              <span class="text-muted small">${manualLabel}</span>
            </div>
            <input
              id="${queryId}"
              class="form-control form-control-sm"
              type="text"
              placeholder="Search payee, category, purpose..."
              data-action="project-tx-query"
              data-project-id="${project.id}"
            />
            <div id="${resultsId}" class="mt-2 text-muted small">Type to search transactions.</div>
          </div>
          <div>
            <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
              <h4 class="h6 mb-0 flex-grow-1">Last 365 days</h4>
              <span class="text-muted small">${recentEntries.length} tx</span>
            </div>
            ${recentSection}
          </div>
        </div>
        <div class="card-footer">
          ${footerSummary}
        </div>
      </div>
    `;
  });

  wrap.innerHTML = cards.join("");

  charts.forEach((chart) => {
    createOrUpdateChart(chart.id, {
      type: "line",
      data: {
        labels: chart.labels,
        datasets: [
          {
            label: "Net progression",
            data: chart.values,
            borderColor: chart.color,
            backgroundColor: makeFadedColor(chart.color),
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        animation: false,
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
            ticks: { callback: (value) => formatChartCurrency(value) }
          }
        }
      }
    });
  });
}

function buildCategoryTrendSeries() {
  const operatingTx = getOperatingTransactions();
  if (!operatingTx.length) {
    return { labels: [], datasets: [] };
  }

  const months = Array.from(new Set(operatingTx
    .map((tx) => getMonthKey(getTxDate(tx)))
    .filter(Boolean)))
    .sort()
    .slice(-state.rules.monthsToShow);

  const categories = DEFAULT_CATEGORIES.filter((category) => category !== "Income");
  const totalsByCategory = new Map();
  categories.forEach((category) => {
    totalsByCategory.set(category, new Map(months.map((month) => [month, 0])));
  });

  operatingTx.forEach((tx) => {
    if (getFlow(tx) !== FLOW.OUTFLOW) return;
    const date = getTxDate(tx);
    const monthKey = getMonthKey(date);
    if (!monthKey || !months.includes(monthKey)) return;
    const category = sanitizeCategory(tx.category) || getDefaultCategory(tx);
    if (!totalsByCategory.has(category)) return;
    const bucket = totalsByCategory.get(category);
    bucket.set(monthKey, (bucket.get(monthKey) || 0) + Math.abs(tx.amount));
  });

  const datasets = categories
    .map((category, index) => {
      const bucket = totalsByCategory.get(category);
      if (!bucket) return null;
      const data = months.map((month) => bucket.get(month) || 0);
      const total = data.reduce((sum, value) => sum + value, 0);
      if (!total) return null;
      return {
        label: category,
        data,
        borderColor: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length],
        backgroundColor: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length],
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 3,
        fill: false
      };
    })
    .filter(Boolean);

  return {
    labels: months.map((month) => formatMonthLabel(month)),
    datasets
  };
}

function renderCategoryTrendChart() {
  const status = el("categoryTrendStatus");
  if (!window.Chart) {
    if (status) {
      status.textContent = "Category trend chart is unavailable because Chart.js could not load.";
      status.classList.remove("d-none");
    }
    return;
  }

  const series = buildCategoryTrendSeries();
  if (status) {
    if (!series.labels.length || !series.datasets.length) {
      status.textContent = "No category trend data available yet.";
      status.classList.remove("d-none");
    } else {
      status.classList.add("d-none");
    }
  }

  if (!series.labels.length || !series.datasets.length) return;

  const maxValue = Number(state.rules.categoryTrendMax);
  const yScale = {
    beginAtZero: true,
    ticks: { callback: (value) => formatChartCurrency(value) }
  };
  if (Number.isFinite(maxValue) && maxValue > 0) {
    yScale.max = maxValue;
  }

  createOrUpdateChart("categoryTrendChart", {
    type: "line",
    data: series,
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
        y: yScale
      }
    }
  });
}

function buildCategoryMonthlyTable() {
  const operatingTx = getOperatingTransactions();
  if (!operatingTx.length) {
    el("categoryTableWrap").innerHTML = emptyState("No budgeted data available yet.");
    return;
  }

  const months = Array.from(new Set(operatingTx
    .map((tx) => getMonthKey(getTxDate(tx)))
    .filter(Boolean)))
    .sort()
    .slice(-state.rules.monthsToShow);

  const categories = new Map();

  operatingTx.forEach((tx) => {
    const date = getTxDate(tx);
    const monthKey = getMonthKey(date);
    if (!monthKey || !months.includes(monthKey)) return;
    if (getFlow(tx) !== FLOW.OUTFLOW) return;
    const category = tx.category || "Discretionary";
    if (!categories.has(category)) categories.set(category, {});
    const bucket = categories.get(category);
    bucket[monthKey] = (bucket[monthKey] || 0) + Math.abs(tx.amount);
  });

  const rows = Array.from(categories.entries())
    .map(([category, values]) => {
      const total = months.reduce((sum, month) => sum + (values[month] || 0), 0);
      return { category, values, total };
    })
    .sort((a, b) => b.total - a.total);

  const header = months.map((month) => `<th>${formatMonthLabel(month)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = months
        .map((month) => `<td>${row.values[month] ? formatCurrency(row.values[month]) : "N/A"}</td>`)
        .join("");
      return `
        <tr>
          <td>${safeText(row.category)}</td>
          ${cells}
        </tr>
      `;
    })
    .join("");

  el("categoryTableWrap").innerHTML = buildTable(
    ["Category", ...months.map((month) => formatMonthLabel(month))],
    body
  );
}

function renderMonthSelectors() {
  const operatingTx = getOperatingTransactions();
  const analyzedMonths = Array.from(new Set(operatingTx
    .map((tx) => getMonthKey(getTxDate(tx)))
    .filter(Boolean)))
    .sort()
    .reverse();
  const allMonths = Array.from(new Set(state.view.derived
    .map((tx) => getMonthKey(getTxDate(tx)))
    .filter(Boolean)))
    .sort()
    .reverse();

  const monthSelect = el("monthSelect");
  const insightsSelect = el("insightsMonthSelect");
  const txMonth = el("txMonth");
  const txCategory = el("txCategory");
  const txTag = el("txTag");

  const previousMonth = monthSelect.value;
  const previousInsights = insightsSelect ? insightsSelect.value : "";
  const previousTxMonth = txMonth.value;
  const previousCategory = txCategory ? txCategory.value : "all";

  monthSelect.innerHTML = "";
  if (insightsSelect) {
    insightsSelect.innerHTML = "";
  }
  txMonth.innerHTML = "";

  if (!analyzedMonths.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No budgeted months";
    monthSelect.appendChild(option);
    if (insightsSelect) {
      const insightsOption = option.cloneNode(true);
      insightsSelect.appendChild(insightsOption);
    }
  } else {
    analyzedMonths.forEach((monthKey) => {
      const option = document.createElement("option");
      option.value = monthKey;
      option.textContent = formatMonthLabel(monthKey);
      monthSelect.appendChild(option);
      if (insightsSelect) {
        const insightsOption = option.cloneNode(true);
        insightsSelect.appendChild(insightsOption);
      }
    });
  }

  const txOptions = ["all", ...allMonths];
  txOptions.forEach((monthKey) => {
    const label = monthKey === "all" ? "All" : formatMonthLabel(monthKey);
    const option = document.createElement("option");
    option.value = monthKey;
    option.textContent = label;
    txMonth.appendChild(option);
  });

  if (previousMonth && analyzedMonths.includes(previousMonth)) {
    monthSelect.value = previousMonth;
  } else if (analyzedMonths.length) {
    monthSelect.value = analyzedMonths[0];
  }

  if (insightsSelect) {
    if (previousInsights && analyzedMonths.includes(previousInsights)) {
      insightsSelect.value = previousInsights;
    } else if (monthSelect.value) {
      insightsSelect.value = monthSelect.value;
    } else if (analyzedMonths.length) {
      insightsSelect.value = analyzedMonths[0];
    }
  }

  if (previousTxMonth && txOptions.includes(previousTxMonth)) {
    txMonth.value = previousTxMonth;
  } else {
    txMonth.value = "all";
  }

  state.filters.month = txMonth.value;
  if (txCategory) {
    txCategory.value = previousCategory || "all";
    state.filters.category = txCategory.value;
  }
  if (txTag) {
    if (!Array.from(txTag.options).some((opt) => opt.value === txTag.value)) {
      txTag.value = "all";
    }
    state.filters.tag = txTag.value || "all";
  }
}

function renderMonthDrilldown() {
  const selectedMonth = el("monthSelect").value;
  const monthWrap = el("monthCategoryWrap");
  const highlights = el("monthHighlights");
  const operatingTx = getOperatingTransactions();

  if (!selectedMonth) {
    monthWrap.innerHTML = emptyState("No month selected.");
    highlights.innerHTML = "";
    return;
  }

  const monthTx = operatingTx.filter((tx) => getMonthKey(getTxDate(tx)) === selectedMonth);
  if (!monthTx.length) {
    monthWrap.innerHTML = emptyState("No budgeted data for this month.");
    highlights.innerHTML = "";
    return;
  }

  const totals = { inflow: 0, outflow: 0 };
  const categoryTotals = new Map();

  monthTx.forEach((tx) => {
    const flow = getFlow(tx);
    if (flow === FLOW.INFLOW) totals.inflow += tx.amount;
    if (flow === FLOW.OUTFLOW) {
      totals.outflow += Math.abs(tx.amount);
      const category = tx.category || "Discretionary";
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + Math.abs(tx.amount));
    }
  });

  highlights.innerHTML = `
    <div class="col-12 col-md-6">
      <div class="border rounded-3 p-2 bg-white h-100">
        <div class="small text-muted">Inflow</div>
        <div class="fw-semibold">${formatCurrency(totals.inflow)}</div>
      </div>
    </div>
    <div class="col-12 col-md-6">
      <div class="border rounded-3 p-2 bg-white h-100">
        <div class="small text-muted">Outflow</div>
        <div class="fw-semibold">${formatCurrency(totals.outflow)}</div>
      </div>
    </div>
  `;

  const rows = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => `
      <tr>
        <td>${safeText(category)}</td>
        <td class="text-danger fw-semibold">${formatCurrency(total)}</td>
      </tr>
    `)
    .join("");

  monthWrap.innerHTML = buildTable(["Category", "Total"], rows);
}

function buildCategoryCell(tx) {
  const category = tx.category || "Discretionary";
  return `
    <select class="form-select form-select-sm tx-category-select" data-key="${tx.key}">
      ${categoryOptionsHtml(category)}
    </select>
  `;
}

function buildTagCell(tx) {
  const sourceChip = tx.categorySource === "manual"
    ? '<span class="badge text-bg-secondary">Manual</span>'
    : tx.categorySource === "rule"
      ? '<span class="badge text-bg-info">Auto</span>'
      : '<span class="badge text-bg-light text-secondary">Default</span>';
  const excludeChip = tx.excluded ? '<span class="badge text-bg-warning">Excluded</span>' : "";
  return `
    <div class="d-inline-flex gap-1 align-items-center">
      ${sourceChip}
      ${excludeChip}
    </div>
  `;
}

function isTransactionRecurring(tx) {
  const streams = state.recurringStreams || [];
  if (!streams.length) return false;
  const haystack = normalizeString([tx.payee, tx.purpose, tx.description].join(" "));
  if (!haystack) return false;
  return streams.some((stream) => {
    const keyword = normalizeString(stream.keyword);
    return keyword && haystack.includes(keyword);
  });
}

function buildTransactionRow(tx) {
  const date = getTxDate(tx);
  const flow = getFlow(tx);
  const amountClass = tx.amount < 0 ? "text-danger fw-semibold" : "text-success fw-semibold";
  const label = tx.payee || tx.purpose || tx.description || "N/A";
  const safeLabel = safeText(label);
  const safePurpose = safeText(getTxPurposeDisplay(tx) || "");
  let typeLabel = "";
  if (isRefundTransaction(tx)) {
    typeLabel = "Refund";
  } else if (flow === FLOW.INFLOW) {
    typeLabel = "Inflow";
  } else if (flow === FLOW.OUTFLOW) {
    typeLabel = "Outflow";
  } else {
    typeLabel = "Zero";
  }
  const isOutflow = flow === FLOW.OUTFLOW;
  const isRecurring = isOutflow && isTransactionRecurring(tx);
  const recurringAction = isOutflow
    ? isRecurring
      ? '<span class="text-muted">Recurring</span>'
      : `<button class="btn btn-sm btn-outline-primary" data-action="prefill-recurring" data-key="${tx.key}">Mark recurring</button>`
    : '<span class="text-muted">&mdash;</span>';
  return `
    <tr data-key="${tx.key}">
      <td>${formatDate(date)}</td>
      <td><span class="d-inline-block tx-label" title="${safeLabel}">${safeLabel}</span></td>
      <td class="tx-purpose-cell"><span class="tx-purpose" title="${safePurpose}">${safePurpose}</span></td>
      <td>${buildCategoryCell(tx)}</td>
      <td>${buildTagCell(tx)}</td>
      <td>${typeLabel}</td>
      <td>${recurringAction}</td>
      <td class="${amountClass}">${formatCurrency(tx.amount)}</td>
    </tr>
  `;
}

function prefillRecurringFromTransaction(tx) {
  const label = (tx.payee || tx.purpose || tx.description || "").trim();
  const keyword = normalizePayee(label) || normalizeString(label);
  const labelInput = el("recurringLabel");
  const keywordInput = el("recurringKeyword");
  if (!labelInput || !keywordInput) return;
  labelInput.value = label || "Recurring expense";
  keywordInput.value = keyword;
  state.recurringEditingId = null;
  syncRecurringFormState();
  renderRecurringPreview();
  setActiveSection("recurring");
}

function buildExcludedTransactionRow(tx) {
  const date = getTxDate(tx);
  const amountClass = tx.amount < 0 ? "text-danger fw-semibold" : "text-success fw-semibold";
  const label = tx.payee || tx.purpose || tx.description || "N/A";
  const safeLabel = safeText(label);
  const safePurpose = safeText(getTxPurposeDisplay(tx) || "");
  const category = sanitizeCategory(tx.category) || getDefaultCategory(tx);
  const reason = tx.excludedReason || "Excluded";
  return `
    <tr data-key="${tx.key}">
      <td>${formatDate(date)}</td>
      <td><span class="d-inline-block tx-label" title="${safeLabel}">${safeLabel}</span></td>
      <td class="tx-purpose-cell"><span class="tx-purpose" title="${safePurpose}">${safePurpose}</span></td>
      <td>${safeText(category)}</td>
      <td>${safeText(reason)}</td>
      <td class="${amountClass}">${formatCurrency(tx.amount)}</td>
    </tr>
  `;
}

function renderHighValueTransactions() {
  const wrap = el("highValueTableWrap");
  if (!wrap) return;

  if (!state.view.derived.length) {
    wrap.innerHTML = emptyState("No transactions loaded yet.");
    return;
  }

  const excluded = state.view.derived
    .filter((tx) => tx.excluded)
    .sort((a, b) => {
      const amountDiff = Math.abs(b.amount) - Math.abs(a.amount);
      if (amountDiff !== 0) return amountDiff;
      return getTxDate(b) - getTxDate(a);
    })
    .slice(0, 200);

  if (!excluded.length) {
    wrap.innerHTML = emptyState("No excluded transactions yet.");
    return;
  }

  const rows = excluded.map((tx) => buildExcludedTransactionRow(tx)).join("");
  wrap.innerHTML = buildTable(
    ["Date", "Payee", "Purpose", "Category", "Exclusion reason", "Amount"],
    rows,
    { tableClass: "tx-table" }
  );
}

function parseAmountFilter(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function renderTransactionsTable() {
  const txWrap = el("txTableWrap");

  if (!state.view.derived.length) {
    txWrap.innerHTML = emptyState("No transactions loaded yet.");
    return;
  }

  const search = normalizeString(state.filters.search);
  const flowFilter = state.filters.flow;
  const categoryFilter = state.filters.category;
  const tagFilter = state.filters.tag || "all";
  const minAmount = parseAmountFilter(state.filters.minAmount);
  const maxAmount = parseAmountFilter(state.filters.maxAmount);
  const monthFilter = state.filters.month;
  const showExcluded = state.filters.showExcluded;

  const filtered = state.view.derived
    .filter((tx) => {
      if (monthFilter !== "all" && getMonthKey(getTxDate(tx)) !== monthFilter) return false;
      if (!showExcluded && tx.excluded) return false;
      const flow = getFlow(tx);
      if (flowFilter === "refund" && !isRefundTransaction(tx)) return false;
      if (flowFilter === "inflow" && flow !== FLOW.INFLOW) return false;
      if (flowFilter === "outflow" && flow !== FLOW.OUTFLOW) return false;
      if (categoryFilter !== "all") {
        const category = sanitizeCategory(tx.category) || getDefaultCategory(tx);
        if (category !== categoryFilter) return false;
      }
      if (tagFilter !== "all") {
        if (tagFilter === "manual" && tx.categorySource !== "manual") return false;
        if (tagFilter === "rule" && tx.categorySource !== "rule") return false;
        if (tagFilter === "default" && tx.categorySource !== "default") return false;
      }
      if (minAmount !== null || maxAmount !== null) {
        const absAmount = Math.abs(tx.amount || 0);
        if (minAmount !== null && absAmount < minAmount) return false;
        if (maxAmount !== null && absAmount > maxAmount) return false;
      }
      if (search) {
        const hay = normalizeString([tx.payee, tx.category, tx.purpose, tx.description].join(" "));
        if (!hay.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => getTxDate(b) - getTxDate(a));

  const rows = filtered.map((tx) => buildTransactionRow(tx)).join("");

  txWrap.innerHTML = buildTable(
    TX_TABLE_HEADERS,
    rows || `<tr><td colspan="${TX_TABLE_HEADERS.length}" class="text-muted">No results</td></tr>`,
    { tableClass: "tx-table" }
  );
}

function buildNetWorthHistory() {
  const sources = state.netWorth?.sources || [];
  const records = state.netWorth?.records || [];
  return records
    .map((record) => {
      const dateObj = parseNetWorthDate(record.date);
      if (!(dateObj instanceof Date) || Number.isNaN(dateObj.valueOf())) return null;
      const total = calculateNetWorthTotal(record, sources);
      if (!Number.isFinite(total)) return null;
      return { date: dateObj, total };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

function getNetWorthWindow(history, lookbackMonths) {
  if (!history.length) return null;
  const latest = history[history.length - 1];
  const safeLookback = Math.max(3, Math.round(Number(lookbackMonths) || 3));
  const cutoff = new Date(latest.date.getFullYear(), latest.date.getMonth() - (safeLookback - 1), 1);
  let window = history.filter((entry) => entry.date >= cutoff);
  if (window.length < 2) window = history;
  const start = window[0];
  const end = window[window.length - 1];
  const monthsDiff = (end.date.getFullYear() - start.date.getFullYear()) * 12
    + (end.date.getMonth() - start.date.getMonth());
  const daysDiff = (end.date - start.date) / MS_PER_DAY;
  const yearsDiff = monthsDiff > 0 ? monthsDiff / 12 : (daysDiff > 0 ? daysDiff / 365.25 : 0);
  const monthsApprox = monthsDiff > 0 ? monthsDiff : (daysDiff > 0 ? daysDiff / 30.4375 : 0);
  return {
    start,
    end,
    monthsDiff,
    monthsApprox,
    yearsDiff
  };
}

function getForecastSettings() {
  const lookbackMonths = Number.isFinite(state.rules.forecastNetWorthLookback)
    ? Math.max(3, Math.round(state.rules.forecastNetWorthLookback))
    : defaultRules.forecastNetWorthLookback;
  const method = FORECAST_NET_WORTH_METHODS.includes(state.rules.forecastNetWorthMethod)
    ? state.rules.forecastNetWorthMethod
    : defaultRules.forecastNetWorthMethod;
  const overrideGrowth = Number.isFinite(state.rules.forecastNetWorthGrowth)
    ? state.rules.forecastNetWorthGrowth
    : null;
  const annualContribution = Number.isFinite(state.rules.forecastNetWorthContribution)
    ? state.rules.forecastNetWorthContribution
    : defaultRules.forecastNetWorthContribution;
  return { lookbackMonths, method, overrideGrowth, annualContribution };
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getForecastSplitEntries() {
  const splits = Array.isArray(state.rules.forecastNetWorthSplits)
    ? state.rules.forecastNetWorthSplits
    : [];
  return splits.map((split) => ({
    id: split.id,
    label: split.label || "",
    weight: parseOptionalNumber(split.weight),
    growth: parseOptionalNumber(split.growth)
  }));
}

function buildNetWorthProjectionSeries(settings = null, years = 5) {
  const {
    lookbackMonths,
    method,
    overrideGrowth,
    annualContribution
  } = settings || getForecastSettings();

  const history = buildNetWorthHistory();
  if (history.length < 2) return null;

  const window = getNetWorthWindow(history, lookbackMonths);
  if (!window || window.yearsDiff <= 0) return null;

  const { start, end, monthsApprox, yearsDiff } = window;
  const baseNetWorth = Number.isFinite(end.total) ? end.total : null;
  if (!Number.isFinite(baseNetWorth)) return null;

  let annualRate = null;
  let monthlyChange = null;

  if (Number.isFinite(overrideGrowth)) {
    annualRate = overrideGrowth / 100;
  } else if (method === "cagr" && start.total > 0 && end.total > 0 && yearsDiff > 0) {
    annualRate = Math.pow(end.total / start.total, 1 / yearsDiff) - 1;
  } else if (monthsApprox > 0) {
    monthlyChange = (end.total - start.total) / monthsApprox;
  }

  const splitEntries = getForecastSplitEntries();
  const activeSplits = splitEntries.filter((split) => Number.isFinite(split.weight) && split.weight > 0);
  const totalWeight = activeSplits.reduce((sum, split) => sum + split.weight, 0);
  const useSplits = totalWeight > 0;
  const hasSplitGrowth = useSplits && activeSplits.some((split) => Number.isFinite(split.growth));

  if (annualRate === null && monthlyChange === null && !hasSplitGrowth) return null;

  const toMonthlyRate = (rate) => {
    if (!Number.isFinite(rate)) return null;
    if (rate <= -1) return rate / 12;
    return Math.pow(1 + rate, 1 / 12) - 1;
  };

  const monthlyRate = toMonthlyRate(annualRate);
  const monthlyContribution = Number.isFinite(annualContribution)
    ? annualContribution / 12
    : 0;

  let runningBalance = baseNetWorth;
  let splitBalances = null;
  let splitWeights = null;
  if (useSplits) {
    splitWeights = activeSplits.map((split) => split.weight / totalWeight);
    splitBalances = activeSplits.map((_, index) => baseNetWorth * splitWeights[index]);
  }

  const labels = [];
  const totals = [];

  const monthsToProject = Math.max(1, Math.round(years * 12));
  let cursor = new Date(end.date.getFullYear(), end.date.getMonth(), 1);

  for (let i = 0; i < monthsToProject; i += 1) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    if (useSplits) {
      splitBalances = splitBalances.map((balance, index) => {
        const split = activeSplits[index];
        const weightShare = splitWeights[index];
        const splitMonthlyRate = Number.isFinite(split.growth)
          ? toMonthlyRate(split.growth / 100)
          : null;
        if (splitMonthlyRate !== null) {
          return balance * (1 + splitMonthlyRate);
        }
        if (monthlyRate !== null) {
          return balance * (1 + monthlyRate);
        }
        if (monthlyChange !== null) {
          return balance + monthlyChange * weightShare;
        }
        return balance;
      });

      if (monthlyContribution) {
        splitBalances = splitBalances.map(
          (balance, index) => balance + monthlyContribution * splitWeights[index]
        );
      }

      runningBalance = splitBalances.reduce((sum, value) => sum + value, 0);
    } else {
      if (monthlyRate !== null) {
        runningBalance *= (1 + monthlyRate);
      } else if (monthlyChange !== null) {
        runningBalance += monthlyChange;
      }
      if (monthlyContribution) {
        runningBalance += monthlyContribution;
      }
    }

    labels.push(formatMonthLabel(getMonthKey(cursor)));
    totals.push(runningBalance);
  }

  return { labels, totals };
}

function renderForecastSplits() {
  const wrap = el("forecastSplitTable");
  if (!wrap) return;
  const splits = Array.isArray(state.rules.forecastNetWorthSplits)
    ? state.rules.forecastNetWorthSplits
    : [];

  if (!splits.length) {
    wrap.innerHTML = emptyState("No split parts yet.");
    return;
  }

  const rows = splits
    .map((split) => {
      const labelValue = split.label || "";
      const weightValue = Number.isFinite(split.weight) ? split.weight : "";
      const growthValue = Number.isFinite(split.growth) ? split.growth : "";
      return `
        <tr>
          <td>
            <input class="form-control form-control-sm" type="text" data-split-field="label" data-id="${split.id}" value="${escapeHtml(labelValue)}" />
          </td>
          <td>
            <input class="form-control form-control-sm" type="number" step="0.1" min="0" data-split-field="weight" data-id="${split.id}" value="${escapeHtml(weightValue)}" />
          </td>
          <td>
            <input class="form-control form-control-sm" type="number" step="0.1" data-split-field="growth" data-id="${split.id}" value="${escapeHtml(growthValue)}" />
          </td>
          <td>
            <button class="btn btn-sm btn-outline-danger" data-action="remove-forecast-split" data-id="${split.id}">Remove</button>
          </td>
        </tr>
      `;
    })
    .join("");

  wrap.innerHTML = buildTable(
    ["Part", "Weight", "Annual growth (%)", "Action"],
    rows,
    { tableClass: "small" }
  );
}

function renderForecastProjection(settings = null) {
  const tableWrap = el("forecastTableWrap");
  const summary = el("forecastSummary");
  if (!tableWrap || !summary) return;

  const {
    lookbackMonths,
    method,
    overrideGrowth,
    annualContribution
  } = settings || getForecastSettings();

  const history = buildNetWorthHistory();
  if (history.length < 2) {
    summary.textContent = "Add at least two net worth records to forecast.";
    tableWrap.innerHTML = "";
    return;
  }

  const window = getNetWorthWindow(history, lookbackMonths);
  if (!window || window.yearsDiff <= 0) {
    summary.textContent = "Not enough net worth history to forecast.";
    tableWrap.innerHTML = "";
    return;
  }

  const { start, end, monthsDiff, monthsApprox, yearsDiff } = window;
  const baseNetWorth = Number.isFinite(end.total) ? end.total : 0;
  let annualRate = null;
  let monthlyChange = null;
  let methodLabel = method === "linear" ? "Average monthly change" : "CAGR (compounded)";
  let methodUsed = method;

  if (Number.isFinite(overrideGrowth)) {
    annualRate = overrideGrowth / 100;
    methodLabel = "Manual annual growth";
    methodUsed = "manual";
  } else if (method === "cagr" && start.total > 0 && end.total > 0 && yearsDiff > 0) {
    annualRate = Math.pow(end.total / start.total, 1 / yearsDiff) - 1;
  } else if (monthsApprox > 0) {
    monthlyChange = (end.total - start.total) / monthsApprox;
    methodLabel = "Average monthly change";
    methodUsed = "linear";
  }

  const splitEntries = getForecastSplitEntries();
  const activeSplits = splitEntries.filter((split) => Number.isFinite(split.weight) && split.weight > 0);
  const totalWeight = activeSplits.reduce((sum, split) => sum + split.weight, 0);
  const useSplits = totalWeight > 0;
  const hasSplitGrowth = useSplits && activeSplits.some((split) => Number.isFinite(split.growth));

  if (annualRate === null && monthlyChange === null && !hasSplitGrowth) {
    summary.textContent = "Unable to derive a projection from the available net worth data.";
    tableWrap.innerHTML = "";
    return;
  }
  const baseFallbackAvailable = annualRate !== null || monthlyChange !== null;
  const fallbackNeeded = useSplits
    && baseFallbackAvailable
    && activeSplits.some((split) => !Number.isFinite(split.growth));

  const rows = [];
  const baseYear = end.date.getFullYear();
  let runningBalance = baseNetWorth;
  let splitBalances = null;
  let splitWeights = null;
  if (useSplits) {
    splitWeights = activeSplits.map((split) => split.weight / totalWeight);
    splitBalances = activeSplits.map((split, index) => baseNetWorth * splitWeights[index]);
  }

  for (let i = 1; i <= 5; i += 1) {
    let growthAmount = 0;

    if (useSplits) {
      splitBalances = splitBalances.map((balance, index) => {
        const split = activeSplits[index];
        const weightShare = splitWeights[index];
        const splitGrowth = Number.isFinite(split.growth) ? split.growth / 100 : null;
        if (splitGrowth !== null) {
          const next = balance * (1 + splitGrowth);
          growthAmount += next - balance;
          return next;
        }
        if (annualRate !== null) {
          const next = balance * (1 + annualRate);
          growthAmount += next - balance;
          return next;
        }
        if (monthlyChange !== null) {
          const linearShare = monthlyChange * 12 * weightShare;
          growthAmount += linearShare;
          return balance + linearShare;
        }
        return balance;
      });

      if (annualContribution) {
        splitBalances = splitBalances.map(
          (balance, index) => balance + annualContribution * splitWeights[index]
        );
      }

      runningBalance = splitBalances.reduce((sum, value) => sum + value, 0);
    } else {
      const before = runningBalance;
      if (annualRate !== null) {
        runningBalance *= (1 + annualRate);
        growthAmount = runningBalance - before;
      } else if (monthlyChange !== null) {
        const linearDelta = monthlyChange * 12;
        runningBalance += linearDelta;
        growthAmount = linearDelta;
      }
      if (annualContribution) {
        runningBalance += annualContribution;
      }
    }

    rows.push(`
      <tr>
        <td>${baseYear + i}</td>
        <td class="text-success fw-semibold">${formatCurrency(growthAmount)}</td>
        <td class="text-primary fw-semibold">${formatCurrency(annualContribution || 0)}</td>
        <td class="fw-semibold">${formatCurrency(runningBalance)}</td>
      </tr>
    `);
  }

  const windowLabel = monthsDiff > 0
    ? `${monthsDiff} months`
    : `${Math.max(1, Math.round(monthsApprox || 0))} months`;
  const growthLabel = annualRate !== null
    ? `${(annualRate * 100).toFixed(2)}%`
    : `${formatCurrency(monthlyChange)} / month`;
  const startLabel = formatDate(start.date);
  const endLabel = formatDate(end.date);
  const methodLine = useSplits
    ? `Split growth rates${fallbackNeeded ? ` (fallback: ${methodLabel}${methodUsed === "manual" ? " (override)" : ""})` : ""}`
    : `${methodLabel}${methodUsed === "manual" ? " (override)" : ""}`;
  const splitSummary = useSplits
    ? `<div><strong>Split parts:</strong> ${activeSplits.length}</div>`
    : "";

  const contributionLabel = Number.isFinite(annualContribution)
    ? formatCurrency(annualContribution)
    : formatCurrency(0);
  summary.innerHTML = `
    <div><strong>Latest net worth:</strong> ${formatCurrency(baseNetWorth)} (as of ${endLabel})</div>
    <div><strong>History window:</strong> ${startLabel} to ${endLabel} (${windowLabel})</div>
    <div><strong>Method:</strong> ${methodLine}</div>
    <div><strong>Implied growth:</strong> ${useSplits ? "Varies by split" : growthLabel}</div>
    <div><strong>Annual salary contribution:</strong> ${contributionLabel}</div>
    ${splitSummary}
  `;
  tableWrap.innerHTML = buildTable(
    ["Year", "Compounding", "Salary Increase", "Projected Net Worth"],
    rows.join("")
  );
}

function renderForecast() {
  const { lookbackMonths, method, overrideGrowth, annualContribution } = getForecastSettings();
  if (el("forecastNetWorthLookback")) el("forecastNetWorthLookback").value = lookbackMonths;
  if (el("forecastNetWorthMethod")) el("forecastNetWorthMethod").value = method;
  if (el("forecastNetWorthGrowth")) {
    el("forecastNetWorthGrowth").value = Number.isFinite(overrideGrowth) ? overrideGrowth : "";
  }
  if (el("forecastNetWorthContribution")) {
    el("forecastNetWorthContribution").value = Number.isFinite(annualContribution)
      ? annualContribution
      : "";
  }
  renderForecastSplits();
  renderForecastProjection({ lookbackMonths, method, overrideGrowth, annualContribution });
}

const RETIREMENT_EXPENSE_METHOD_LABELS = {
  average: "Average monthly outflow",
  median: "Median monthly outflow",
  trimmed: "Trimmed average (drop top month)",
  custom: "Custom monthly outflow"
};

const RETIREMENT_EXPENSE_CATEGORY_OPTIONS = DEFAULT_CATEGORIES
  .filter((category) => category !== "Income");

function normalizeRetirementExpenseMethod(value) {
  return Object.prototype.hasOwnProperty.call(RETIREMENT_EXPENSE_METHOD_LABELS, value)
    ? value
    : defaultRules.retirementExpenseMethod;
}

function normalizeRetirementExpenseCategories(value) {
  if (!Array.isArray(value)) return [...RETIREMENT_EXPENSE_CATEGORY_OPTIONS];
  return value.filter((category) => RETIREMENT_EXPENSE_CATEGORY_OPTIONS.includes(category));
}

function buildRetirementExpenseProfile(monthsBack, categories) {
  const operatingTx = getOperatingTransactions();
  const latestDate = getLatestTransactionDate(operatingTx) || new Date();
  const safeMonths = Math.max(1, Math.round(Number(monthsBack) || 1));
  const monthKeys = getRecentMonthKeys(safeMonths, latestDate);
  const buckets = new Map(monthKeys.map((key) => [key, 0]));
  const categorySet = Array.isArray(categories) ? new Set(categories) : null;

  operatingTx.forEach((tx) => {
    const date = getTxDate(tx);
    if (!date) return;
    const monthKey = getMonthKey(date);
    if (!buckets.has(monthKey)) return;
    if (getFlow(tx) !== FLOW.OUTFLOW) return;
    const category = sanitizeCategory(tx.category) || getDefaultCategory(tx);
    if (categorySet && !categorySet.has(category)) return;
    buckets.set(monthKey, buckets.get(monthKey) + Math.abs(tx.amount));
  });

  const monthlyTotals = monthKeys.map((key) => buckets.get(key) || 0);
  const total = monthlyTotals.reduce((sum, value) => sum + value, 0);
  const count = monthlyTotals.length || 1;
  const average = total / count;
  const maxValue = monthlyTotals.length ? Math.max(...monthlyTotals) : 0;
  const trimmed = monthlyTotals.length > 1
    ? (total - maxValue) / (monthlyTotals.length - 1)
    : average;
  const medianValue = median(monthlyTotals) ?? average;

  return {
    monthKeys,
    monthlyTotals,
    total,
    average,
    median: medianValue,
    trimmed
  };
}

function pickRetirementExpenseBase(profile, method, customValue) {
  const safeMethod = normalizeRetirementExpenseMethod(method);
  if (safeMethod === "custom") {
    const customMonthly = Number.isFinite(customValue) ? customValue : null;
    return {
      monthly: customMonthly,
      label: RETIREMENT_EXPENSE_METHOD_LABELS.custom
    };
  }

  let monthly = profile.average;
  if (safeMethod === "median") monthly = profile.median;
  if (safeMethod === "trimmed") monthly = profile.trimmed;
  return {
    monthly,
    label: RETIREMENT_EXPENSE_METHOD_LABELS[safeMethod] || RETIREMENT_EXPENSE_METHOD_LABELS.average
  };
}

function getLatestNetWorthSnapshot() {
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
  const latest = withDates[withDates.length - 1];
  return {
    total: calculateNetWorthTotal(latest.record, sources),
    date: latest.dateObj
  };
}

function renderRetirementEstimator() {
  const summary = el("retirementSummary");
  const projectionWrap = el("retirementExpenseTableWrap");
  if (!summary) return;

  const currentAge = Number.isFinite(state.rules.retirementCurrentAge)
    ? state.rules.retirementCurrentAge
    : null;
  const retirementAge = Number.isFinite(state.rules.retirementAge)
    ? state.rules.retirementAge
    : defaultRules.retirementAge;
  const existingEP = Number.isFinite(state.rules.retirementExistingEP)
    ? state.rules.retirementExistingEP
    : 0;
  const sex = state.rules.retirementSex || defaultRules.retirementSex;
  const useLifeExpectancy = Boolean(state.rules.retirementUseLifeExpectancy);
  const investedShareRaw = Number.isFinite(state.rules.retirementInvestedShare)
    ? state.rules.retirementInvestedShare
    : defaultRules.retirementInvestedShare;
  const marketGrowthRaw = Number.isFinite(state.rules.retirementMarketGrowth)
    ? state.rules.retirementMarketGrowth
    : defaultRules.retirementMarketGrowth;
  const autoLifeExpectancy = sex === "male"
    ? LIFE_EXPECTANCY_GERMANY.male
    : sex === "female"
      ? LIFE_EXPECTANCY_GERMANY.female
      : (LIFE_EXPECTANCY_GERMANY.male + LIFE_EXPECTANCY_GERMANY.female) / 2;
  const lifeExpectancy = Number.isFinite(state.rules.retirementLifeExpectancy)
    ? state.rules.retirementLifeExpectancy
    : (useLifeExpectancy ? autoLifeExpectancy : null);

  if (el("retirementCurrentAge")) el("retirementCurrentAge").value = currentAge ?? "";
  if (el("retirementAge")) el("retirementAge").value = retirementAge;
  if (el("retirementExistingEP")) el("retirementExistingEP").value = existingEP || "";
  if (el("retirementSex")) el("retirementSex").value = sex;
  if (el("retirementUseLifeExpectancy")) el("retirementUseLifeExpectancy").checked = useLifeExpectancy;
  if (el("retirementLifeExpectancy")) {
    el("retirementLifeExpectancy").value = Number.isFinite(lifeExpectancy) ? lifeExpectancy : "";
    el("retirementLifeExpectancy").disabled = useLifeExpectancy;
  }
  if (el("retirementInvestedShare")) {
    el("retirementInvestedShare").value = Number.isFinite(investedShareRaw) ? investedShareRaw : "";
  }
  if (el("retirementMarketGrowth")) {
    el("retirementMarketGrowth").value = Number.isFinite(marketGrowthRaw) ? marketGrowthRaw : "";
  }

  if (!Number.isFinite(currentAge) || currentAge <= 0) {
    summary.textContent = "Add your current age to estimate retirement spending.";
    if (projectionWrap) projectionWrap.innerHTML = "";
    return;
  }

  if (!Number.isFinite(lifeExpectancy) || lifeExpectancy <= currentAge) {
    summary.textContent = "Add a valid life expectancy to estimate retirement spending.";
    if (projectionWrap) projectionWrap.innerHTML = "";
    return;
  }

  const netWorthSnapshot = getLatestNetWorthSnapshot();
  if (!netWorthSnapshot || !Number.isFinite(netWorthSnapshot.total)) {
    summary.textContent = "Add a net worth snapshot to estimate retirement spending.";
    if (projectionWrap) projectionWrap.innerHTML = "";
    return;
  }

  const netWorthTotal = netWorthSnapshot.total;
  if (!Number.isFinite(netWorthTotal) || netWorthTotal <= 0) {
    summary.textContent = "Net worth must be positive to estimate retirement spending.";
    if (projectionWrap) projectionWrap.innerHTML = "";
    return;
  }

  const yearsRemaining = Math.max(1, Math.round(lifeExpectancy - currentAge));
  const investedShare = Math.min(100, Math.max(0, investedShareRaw)) / 100;
  const annualReturn = Number.isFinite(marketGrowthRaw) ? marketGrowthRaw / 100 : 0;
  const effectiveGrowth = Math.max(-0.95, investedShare * annualReturn);

  const monthlyPension = existingEP
    * GERMAN_PENSION.zugangsfaktor
    * GERMAN_PENSION.rentenartfaktor
    * GERMAN_PENSION.rentenwert;
  const annualPension = monthlyPension * 12;
  const netWorthDate = netWorthSnapshot.date ? formatDate(netWorthSnapshot.date) : "";

  const canSustain = (monthlySpend) => {
    let balance = netWorthTotal;
    const annualSpend = monthlySpend * 12;
    for (let i = 0; i < yearsRemaining; i += 1) {
      const age = currentAge + i;
      balance *= (1 + effectiveGrowth);
      const pension = age >= retirementAge ? annualPension : 0;
      const withdrawal = Math.max(0, annualSpend - pension);
      balance -= withdrawal;
      if (balance < -0.01) return false;
    }
    return true;
  };

  let high = Math.max(1000, annualPension / 12 + (netWorthTotal / Math.max(1, yearsRemaining)) / 12);
  let guard = 0;
  while (canSustain(high) && guard < 30) {
    high *= 2;
    guard += 1;
  }

  let low = 0;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (canSustain(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const maxMonthlySpend = Math.max(0, low);

  const summaryLines = [
    `<div><strong>Monthly spend if you retire now:</strong> ${formatCurrency(maxMonthlySpend)}</div>`,
    `<div><strong>Net worth used:</strong> ${formatCurrency(netWorthTotal)}${netWorthDate ? ` (as of ${netWorthDate})` : ""}</div>`,
    `<div><strong>Invested share:</strong> ${Math.round(investedShare * 100)}% at ${marketGrowthRaw.toFixed(1)}% annual growth</div>`,
    `<div><strong>Monthly pension (gross, from age ${retirementAge}):</strong> ${formatCurrency(monthlyPension)}</div>`,
    `<div><strong>Life expectancy:</strong> ${lifeExpectancy.toFixed(1)} years</div>`
  ];

  summaryLines.push(`
    <div class="small text-muted mt-2">
      Assumes statutory formula (EP x Zugangsfaktor x Rentenartfaktor x aktueller Rentenwert) with no future EP accrual.
      Uses Rentenwert EUR ${GERMAN_PENSION.rentenwert.toFixed(2)} (from ${GERMAN_PENSION.rentenwertEffectiveDate})
      and provisional average earnings ${GERMAN_PENSION.durchschnittsentgeltYear} EUR ${GERMAN_PENSION.durchschnittsentgelt.toLocaleString("en-GB")}.
      Values are gross and before taxes/health insurance.
    </div>
    <div class="small text-muted mt-1">
      Life expectancy default uses Germany ${LIFE_EXPECTANCY_GERMANY.year} at-birth estimates (female ${LIFE_EXPECTANCY_GERMANY.female}, male ${LIFE_EXPECTANCY_GERMANY.male}).
      Net worth projection assumes constant annual growth on the invested share, 0% on the remainder, and flat spending.
    </div>
  `);

  summary.innerHTML = summaryLines.join("");

  if (projectionWrap) {
    const currentYear = new Date().getFullYear();
    const rows = [];
    let balance = netWorthTotal;
    const annualSpend = maxMonthlySpend * 12;
    for (let i = 0; i < yearsRemaining; i += 1) {
      const year = currentYear + i;
      const age = Math.round(currentAge + i);
      balance *= (1 + effectiveGrowth);
      const pension = age >= retirementAge ? annualPension : 0;
      const withdrawal = Math.max(0, annualSpend - pension);
      balance -= withdrawal;
      rows.push(`
        <tr>
          <td>${year}</td>
          <td>${age}</td>
          <td class="text-success fw-semibold">${formatCurrency(pension)}</td>
          <td class="text-danger fw-semibold">${formatCurrency(withdrawal)}</td>
          <td class="fw-semibold">${formatCurrency(Math.max(0, balance))}</td>
        </tr>
      `);
    }
    if (!rows.length) {
      projectionWrap.innerHTML = "";
    } else {
      projectionWrap.innerHTML = buildTable(
        ["Year", "Age", "Pension", "Net worth draw", "End balance"],
        rows.join(""),
        { tableClass: "small" }
      );
    }
  }
}

function render() {
  refreshDerived();
  const ruleHitCounts = collectRuleHitCounts();
  renderSummary();
  renderDatabaseOverview();
  renderExpenseRuleTable(ruleHitCounts.expenseCounts);
  renderIncomeRuleTable(ruleHitCounts.incomeCounts);
  renderExclusionRuleTable(ruleHitCounts.exclusionCounts);
  renderExclusionAllowlist();
  renderProposedRules();
  renderOverridesTable();
  renderRecurring();
  renderProjects();
  renderCategoryTrendChart();
  buildCategoryMonthlyTable();
  renderMonthSelectors();
  renderMonthDrilldown();
  renderCharts();
  renderForecast();
  renderRetirementEstimator();
  renderNetWorthSection();
  renderHighValueTransactions();
  renderTransactionsTable();
}

