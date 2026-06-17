function setNetWorthImportStatus(message, variant = "light") {
  const status = el("netWorthImportStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.remove("d-none", "alert-success", "alert-danger", "alert-warning", "alert-light");
  status.classList.add(`alert-${variant}`);
}

function clearNetWorthImportStatus() {
  const status = el("netWorthImportStatus");
  if (!status) return;
  status.textContent = "";
  status.classList.add("d-none");
  status.classList.remove("alert-success", "alert-danger", "alert-warning");
  status.classList.add("alert-light");
}

function bindTransactionTableEvents(wrapId) {
  const wrap = el(wrapId);
  if (!wrap) return;

  wrap.addEventListener("click", (event) => {
    const recurringBtn = event.target.closest("button[data-action=\"prefill-recurring\"]");
    if (recurringBtn) {
      const key = recurringBtn.dataset.key;
      const tx = state.view.derived.find((item) => item.key === key);
      if (tx) {
        prefillRecurringFromTransaction(tx);
      }
      return;
    }
    const row = event.target.closest("tr[data-key]");
    if (!row) return;
    const key = row.dataset.key;
    const tx = state.view.derived.find((item) => item.key === key);
    if (tx) setOverrideTarget(tx);
  });

  wrap.addEventListener("change", (event) => {
    const select = event.target.closest(".tx-category-select");
    if (!select) return;
    const key = select.dataset.key;
    const tx = state.view.derived.find((item) => item.key === key);
    if (!tx) return;
    const category = sanitizeCategory(select.value);
    applyCategoryOverride(key, category);
    setOverrideTarget(tx);
    render();
  });
}

function setActiveSection(sectionId) {
  const panels = Array.from(document.querySelectorAll("[data-section-panel]"));
  if (!panels.length) return;

  panels.forEach((panel) => {
    const isActive = panel.dataset.sectionPanel === sectionId;
    panel.classList.toggle("is-active", isActive);
    panel.setAttribute("aria-hidden", isActive ? "false" : "true");
  });

  const buttons = Array.from(document.querySelectorAll("[data-section-btn]"));
  buttons.forEach((button) => {
    const isActive = button.dataset.sectionBtn === sectionId;
    button.classList.toggle("btn-primary", isActive);
    button.classList.toggle("btn-outline-primary", !isActive);
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (sectionId === "rules") {
    const seeded = seedDefaultCategoryRulesIfEmpty();
    if (seeded) {
      render();
    }
  }

  if (sectionId === "recurring") {
    const seeded = seedRecurringStreamsIfEmpty();
    if (seeded) {
      render();
    }
  }

  if (sectionId === "insights" || sectionId === "networth" || sectionId === "monthly" || sectionId === "projects") {
    requestAnimationFrame(() => {
      if (sectionId === "insights") {
        renderCharts();
      }
      if (sectionId === "networth") {
        renderNetWorthChart();
      }
      if (sectionId === "monthly") {
        renderCategoryTrendChart();
      }
      if (sectionId === "projects") {
        renderProjects();
      }
      Object.values(state.charts || {}).forEach((chart) => {
        if (chart && typeof chart.resize === "function") {
          chart.resize();
        }
      });
    });
  }

  try {
    localStorage.setItem(SECTION_KEY, sectionId);
  } catch (error) {
    console.warn("Unable to store active section", error);
  }
}

function bindSectionNav() {
  const buttons = Array.from(document.querySelectorAll("[data-section-btn]"));
  if (!buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveSection(button.dataset.sectionBtn);
    });
  });

  let initial = buttons[0].dataset.sectionBtn;
  try {
    const stored = localStorage.getItem(SECTION_KEY);
    if (stored && buttons.some((button) => button.dataset.sectionBtn === stored)) {
      initial = stored;
    }
  } catch (error) {
    console.warn("Unable to load stored section", error);
  }

  setActiveSection(initial);
}

function bindEvents() {
  const csvFileInput = el("csvFile");
  const importBtn = el("importBtn");
  if (csvFileInput && importBtn) {
    importBtn.addEventListener("click", () => {
      csvFileInput.value = "";
      csvFileInput.click();
    });

    csvFileInput.addEventListener("change", async () => {
      if (!csvFileInput.files.length) return;
      await importCSV(csvFileInput.files[0]);
      csvFileInput.value = "";
    });
  }

  el("exportBtn").addEventListener("click", exportJSON);

  const jsonFileInput = el("jsonFile");
  const restoreBtn = el("restoreBtn");
  if (jsonFileInput && restoreBtn) {
    restoreBtn.addEventListener("click", () => {
      jsonFileInput.click();
    });

    jsonFileInput.addEventListener("change", async () => {
      if (!jsonFileInput.files.length) return;
      const proceed = confirm("Restore backup from JSON? This replaces all local data.");
      if (!proceed) {
        jsonFileInput.value = "";
        return;
      }
      await importJSON(jsonFileInput.files[0]);
      jsonFileInput.value = "";
    });
  }

  const amazonFileInput = el("amazonFile");
  const amazonImportBtn = el("amazonImportBtn");
  if (amazonFileInput && amazonImportBtn) {
    amazonImportBtn.addEventListener("click", () => {
      amazonFileInput.click();
    });

    amazonFileInput.addEventListener("change", async () => {
      if (!amazonFileInput.files.length) return;
      await importAmazonOrders(amazonFileInput.files[0]);
      amazonFileInput.value = "";
    });
  }

  const demoBtn = el("demoBtn");
  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      const proceed = confirm("Load demo data? This replaces all local data.");
      if (!proceed) return;
      const summary = applyDemoData();
      syncRulesToUI();
      render();
      clearNetWorthImportStatus();
      clearOverrideForm();
      clearRecurringForm();
      clearProjectForm();
      if (summary && summary.message) {
        el("importStatus").textContent = summary.message;
      }
    });
  }

  el("clearBtn").addEventListener("click", () => {
    if (!confirm("Delete local data?")) return;
    clearBackupStores();
    state.transactions = [];
    state.overrides = {};
    state.archivedRecurring = {};
    state.recurringStreams = [];
    state.recurringEditingId = null;
    state.projects = [];
    state.projectEditingId = null;
    state.netWorth = { sources: [], records: [] };
    clearNetWorthImportStatus();
    clearOverrideForm();
    clearRecurringForm();
    clearProjectForm();
    render();
    el("importStatus").textContent = "Local data cleared.";
  });

  const saveRulesBtn = el("saveRulesBtn");
  if (saveRulesBtn) {
    saveRulesBtn.addEventListener("click", () => {
      const monthsToShow = el("monthsToShow");
      if (monthsToShow) {
        state.rules.monthsToShow = Number(monthsToShow.value) || defaultRules.monthsToShow;
      }
      if (el("exclusionThreshold")) {
        const limit = Number(el("exclusionThreshold").value);
        state.rules.exclusionThreshold = Number.isFinite(limit) && limit >= 0
          ? limit
          : defaultRules.exclusionThreshold;
      }
      if (el("categoryTrendMax")) {
        const maxValue = Number(el("categoryTrendMax").value);
        state.rules.categoryTrendMax = Number.isFinite(maxValue) && maxValue > 0
          ? maxValue
          : defaultRules.categoryTrendMax;
      }
      const proposalMin = Number(el("proposalMin")?.value);
      if (Number.isFinite(proposalMin) && proposalMin > 0) {
        state.rules.proposalMin = proposalMin;
      }
      saveRules();
      render();
    });
  }

  el("addExpenseRuleBtn").addEventListener("click", () => {
    const keyword = el("expenseRuleKeyword").value.trim();
    const category = el("expenseRuleCategory").value.trim();
    const added = addExpenseRule({ keyword, category });
    if (added) {
      el("expenseRuleKeyword").value = "";
      el("expenseRuleCategory").value = "";
      render();
    }
  });

  el("addIncomeRuleBtn").addEventListener("click", () => {
    const keyword = el("incomeRuleKeyword").value.trim();
    const category = el("incomeRuleCategory").value.trim();
    const added = addIncomeRule({ keyword, category });
    if (added) {
      el("incomeRuleKeyword").value = "";
      el("incomeRuleCategory").value = "";
      render();
    }
  });

  const addExclusionRuleBtn = el("addExclusionRuleBtn");
  if (addExclusionRuleBtn) {
    addExclusionRuleBtn.addEventListener("click", () => {
      const keyword = el("exclusionRuleKeyword").value.trim();
      const added = addExclusionRule({ keyword });
      if (added) {
        el("exclusionRuleKeyword").value = "";
        render();
      }
    });
  }

  const addExclusionAllowBtn = el("addExclusionAllowBtn");
  if (addExclusionAllowBtn) {
    addExclusionAllowBtn.addEventListener("click", () => {
      const keyword = el("exclusionAllowKeyword").value.trim();
      const added = addExclusionAllowRule({ keyword });
      if (added) {
        el("exclusionAllowKeyword").value = "";
        render();
      }
    });
  }

  el("expenseRuleTableWrap").addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action=\"remove-expense-rule\"]");
    if (!target) return;
    removeCategoryRule(target.dataset.id, "expense");
    render();
  });

  el("incomeRuleTableWrap").addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action=\"remove-income-rule\"]");
    if (!target) return;
    removeCategoryRule(target.dataset.id, "income");
    render();
  });

  const exclusionRuleTable = el("exclusionRuleTableWrap");
  if (exclusionRuleTable) {
    exclusionRuleTable.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-action=\"remove-exclusion-rule\"]");
      if (!target) return;
      removeExclusionRule(target.dataset.id);
      render();
    });
  }

  const exclusionAllowTable = el("exclusionAllowTableWrap");
  if (exclusionAllowTable) {
    exclusionAllowTable.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-action=\"remove-exclusion-allow\"]");
      if (!target) return;
      removeExclusionAllowRule(target.dataset.id);
      render();
    });
  }

  el("proposalMin").addEventListener("change", (event) => {
    const value = Number(event.target.value);
    state.rules.proposalMin = Number.isFinite(value) && value > 0 ? value : defaultRules.proposalMin;
    saveRules();
    renderProposedRules();
  });

  if (el("exclusionThreshold")) {
    el("exclusionThreshold").addEventListener("change", (event) => {
      const value = Number(event.target.value);
      state.rules.exclusionThreshold = Number.isFinite(value) && value >= 0
        ? value
        : defaultRules.exclusionThreshold;
      saveRules();
      render();
    });
  }

  if (el("categoryTrendMax")) {
    el("categoryTrendMax").addEventListener("input", (event) => {
      const value = Number(event.target.value);
      state.rules.categoryTrendMax = Number.isFinite(value) && value > 0
        ? value
        : defaultRules.categoryTrendMax;
      saveRules();
      renderCategoryTrendChart();
    });
  }

  const forecastInputs = [
    "forecastNetWorthLookback",
    "forecastNetWorthGrowth",
    "forecastNetWorthContribution"
  ];
  const readOptionalNumber = (input) => {
    if (!input) return null;
    const raw = input.value.trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  forecastInputs.forEach((id) => {
    const input = el(id);
    if (!input) return;
    input.addEventListener("input", () => {
      const value = readOptionalNumber(input);
      if (id === "forecastNetWorthLookback") {
        state.rules.forecastNetWorthLookback = Number.isFinite(value) && value > 0
          ? Math.round(value)
          : defaultRules.forecastNetWorthLookback;
      }
      if (id === "forecastNetWorthGrowth") {
        state.rules.forecastNetWorthGrowth = Number.isFinite(value) ? value : null;
      }
      if (id === "forecastNetWorthContribution") {
        state.rules.forecastNetWorthContribution = Number.isFinite(value) ? value : 0;
      }
      saveRules();
      renderForecast();
    });
  });

  const forecastMethod = el("forecastNetWorthMethod");
  if (forecastMethod) {
    forecastMethod.addEventListener("change", () => {
      state.rules.forecastNetWorthMethod = forecastMethod.value;
      saveRules();
      renderForecast();
    });
  }

  const addForecastSplitBtn = el("addForecastSplitBtn");
  if (addForecastSplitBtn) {
    addForecastSplitBtn.addEventListener("click", () => {
      addForecastSplit();
      renderForecast();
    });
  }

  const forecastSplitTable = el("forecastSplitTable");
  if (forecastSplitTable) {
    forecastSplitTable.addEventListener("input", (event) => {
      const input = event.target.closest("input[data-split-field]");
      if (!input) return;
      const splitId = input.dataset.id;
      const field = input.dataset.splitField;
      if (!splitId || !field) return;
      if (field === "label") {
        updateForecastSplit(splitId, { label: input.value });
      } else {
        const raw = input.value.trim();
        const numeric = raw ? Number(raw) : null;
        updateForecastSplit(splitId, { [field]: Number.isFinite(numeric) ? numeric : null });
      }
      renderForecastProjection();
    });

    forecastSplitTable.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-action=\"remove-forecast-split\"]");
      if (!target) return;
      removeForecastSplit(target.dataset.id);
      renderForecast();
    });
  }

  const retirementInputs = [
    "retirementCurrentAge",
    "retirementAge",
    "retirementExistingEP",
    "retirementLifeExpectancy",
    "retirementInvestedShare",
    "retirementMarketGrowth"
  ];
  retirementInputs.forEach((id) => {
    const input = el(id);
    if (!input) return;
    input.addEventListener("input", () => {
      const value = readOptionalNumber(input);
      if (id === "retirementCurrentAge") state.rules.retirementCurrentAge = value;
      if (id === "retirementAge") {
        state.rules.retirementAge = Number.isFinite(value)
          ? value
          : defaultRules.retirementAge;
      }
      if (id === "retirementExistingEP") state.rules.retirementExistingEP = value;
      if (id === "retirementLifeExpectancy") state.rules.retirementLifeExpectancy = value;
      if (id === "retirementInvestedShare") {
        state.rules.retirementInvestedShare = Number.isFinite(value)
          ? Math.min(100, Math.max(0, value))
          : defaultRules.retirementInvestedShare;
      }
      if (id === "retirementMarketGrowth") {
        state.rules.retirementMarketGrowth = Number.isFinite(value)
          ? value
          : defaultRules.retirementMarketGrowth;
      }
      saveRules();
      renderRetirementEstimator();
    });
  });

  const retirementSex = el("retirementSex");
  if (retirementSex) {
    retirementSex.addEventListener("change", () => {
      state.rules.retirementSex = retirementSex.value;
      saveRules();
      renderRetirementEstimator();
    });
  }

  const retirementLifeAuto = el("retirementUseLifeExpectancy");
  if (retirementLifeAuto) {
    retirementLifeAuto.addEventListener("change", () => {
      state.rules.retirementUseLifeExpectancy = retirementLifeAuto.checked;
      if (state.rules.retirementUseLifeExpectancy) {
        state.rules.retirementLifeExpectancy = null;
      }
      saveRules();
      renderRetirementEstimator();
    });
  }

  const retirementProxy = el("retirementUseInflowProxy");
  if (retirementProxy) {
    retirementProxy.addEventListener("change", () => {
      state.rules.retirementUseInflowProxy = retirementProxy.checked;
      if (state.rules.retirementUseInflowProxy) {
        state.rules.retirementAnnualGross = null;
      }
      saveRules();
      renderRetirementEstimator();
    });
  }

  const retirementExpenseMethod = el("retirementExpenseMethod");
  if (retirementExpenseMethod) {
    retirementExpenseMethod.addEventListener("change", () => {
      state.rules.retirementExpenseMethod = retirementExpenseMethod.value;
      saveRules();
      renderRetirementEstimator();
    });
  }

  const retirementExpenseCategories = el("retirementExpenseCategories");
  if (retirementExpenseCategories) {
    retirementExpenseCategories.addEventListener("change", (event) => {
      const checkbox = event.target.closest("input[data-category]");
      if (!checkbox) return;
      const selected = Array.from(
        retirementExpenseCategories.querySelectorAll("input[data-category]")
      )
        .filter((input) => input.checked)
        .map((input) => input.dataset.category);
      state.rules.retirementExpenseCategories = selected;
      saveRules();
      renderRetirementEstimator();
    });
  }

  if (el("addNetWorthSourceBtn")) {
    el("addNetWorthSourceBtn").addEventListener("click", () => {
      const input = el("netWorthSourceInput");
      const added = addNetWorthSource(input.value);
      if (added) {
        input.value = "";
        renderNetWorthSection();
        renderForecast();
      }
    });
  }

  if (el("importNetWorthBtn")) {
    el("importNetWorthBtn").addEventListener("click", () => {
      const input = el("netWorthPasteInput");
      const result = importNetWorthFromPaste(input ? input.value : "");
      if (!result.ok) {
        setNetWorthImportStatus(result.message, "danger");
        return;
      }
      renderNetWorthSection();
      renderForecast();
      const skipped = result.skipped
        ? ` Skipped ${result.skipped} row(s) without valid dates.`
        : "";
      setNetWorthImportStatus(
        `Imported ${result.records} record(s) across ${result.sources} source(s).${skipped}`,
        "success"
      );
    });
  }

  if (el("clearNetWorthPasteBtn")) {
    el("clearNetWorthPasteBtn").addEventListener("click", () => {
      const input = el("netWorthPasteInput");
      if (input) {
        input.value = "";
      }
      clearNetWorthImportStatus();
    });
  }

  if (el("addNetWorthRecordBtn")) {
    el("addNetWorthRecordBtn").addEventListener("click", () => {
      const date = el("netWorthDateInput").value;
      if (!date) return;
      const values = getNetWorthInputValues();
      const added = addNetWorthRecord({ date, values });
      if (added) {
        clearNetWorthRecordInputs();
        renderNetWorthSection();
        renderForecast();
      }
    });
  }

  if (el("netWorthInputs")) {
    el("netWorthInputs").addEventListener("input", () => {
      updateNetWorthTotalPreview();
    });
  }

  if (el("netWorthTable")) {
    el("netWorthTable").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action=\"remove-networth\"]");
      if (!button) return;
      removeNetWorthRecord(button.dataset.id);
      renderNetWorthSection();
      renderForecast();
    });
  }

  el("proposalTableWrap").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action=\"apply-proposal\"]");
    if (!button) return;
    const row = button.closest("tr");
    if (!row) return;
    const keyword = row.querySelector(".proposal-keyword")?.value || "";
    const category = row.querySelector(".proposal-category")?.value || "";
    const added = addExpenseRule({ keyword, category });
    if (added) {
      render();
    }
  });

  el("saveRecurringStreamBtn").addEventListener("click", () => {
    const label = el("recurringLabel").value.trim();
    const keyword = el("recurringKeyword").value.trim();
    if (!keyword) {
      el("recurringPreview").innerHTML = emptyState("Add a keyword to save a stream.");
      return;
    }
    const updated = state.recurringEditingId
      ? updateRecurringStream(state.recurringEditingId, { label, keyword })
      : addRecurringStream({ label, keyword });
    if (updated) {
      clearRecurringForm();
      render();
    }
  });

  el("clearRecurringStreamBtn").addEventListener("click", () => {
    clearRecurringForm();
  });

  el("recurringKeyword").addEventListener("input", () => {
    renderRecurringPreview();
  });

  el("recurringStreamsTable").addEventListener("click", (event) => {
    const editBtn = event.target.closest("button[data-action=\"edit-recurring\"]");
    const previewBtn = event.target.closest("button[data-action=\"preview-recurring\"]");
    const removeBtn = event.target.closest("button[data-action=\"remove-recurring\"]");
    if (editBtn) {
      const stream = state.recurringStreams.find((item) => item.id === editBtn.dataset.id);
      if (stream) {
        setRecurringForm(stream);
      }
      return;
    }
    if (previewBtn) {
      const stream = state.recurringStreams.find((item) => item.id === previewBtn.dataset.id);
      if (stream) {
        el("recurringKeyword").value = stream.keyword;
        el("recurringLabel").value = stream.label;
        state.recurringEditingId = stream.id;
        syncRecurringFormState();
        renderRecurringPreview();
      }
      return;
    }
    if (removeBtn) {
      removeRecurringStream(removeBtn.dataset.id);
      if (state.recurringEditingId === removeBtn.dataset.id) {
        clearRecurringForm();
      }
      render();
    }
  });

  const saveProjectBtn = el("saveProjectBtn");
  if (saveProjectBtn) {
    saveProjectBtn.addEventListener("click", () => {
      const name = el("projectName").value.trim();
      const keywords = el("projectKeywords").value.trim();
      const finished = el("projectFinished").checked;
      const updated = state.projectEditingId
        ? updateProject(state.projectEditingId, { name, keywords, finished })
        : addProject({ name, keywords, finished });
      if (updated) {
        clearProjectForm();
        render();
      }
    });
  }

  const clearProjectBtn = el("clearProjectBtn");
  if (clearProjectBtn) {
    clearProjectBtn.addEventListener("click", () => {
      clearProjectForm();
    });
  }

  const projectsWrap = el("projectsWrap");
  if (projectsWrap) {
    projectsWrap.addEventListener("input", (event) => {
      const queryInput = event.target.closest("input[data-action=\"project-tx-query\"]");
      if (!queryInput) return;
      const projectId = queryInput.dataset.projectId;
      renderProjectTxSearchResults(projectId, queryInput.value);
    });

    projectsWrap.addEventListener("click", (event) => {
      const addTxBtn = event.target.closest("button[data-action=\"add-project-tx\"]");
      const removeTxBtn = event.target.closest("button[data-action=\"remove-project-tx\"]");
      const editBtn = event.target.closest("button[data-action=\"edit-project\"]");
      const toggleBtn = event.target.closest("button[data-action=\"toggle-project\"]");
      const removeBtn = event.target.closest("button[data-action=\"remove-project\"]");

      if (addTxBtn) {
        const added = addProjectTransaction(addTxBtn.dataset.projectId, addTxBtn.dataset.key);
        if (added) {
          render();
        }
        return;
      }
      if (removeTxBtn) {
        removeProjectTransaction(removeTxBtn.dataset.projectId, removeTxBtn.dataset.key);
        render();
        return;
      }
      if (editBtn) {
        const project = state.projects.find((item) => item.id === editBtn.dataset.id);
        if (project) setProjectForm(project);
        return;
      }
      if (toggleBtn) {
        toggleProjectFinished(toggleBtn.dataset.id);
        render();
        return;
      }
      if (removeBtn) {
        removeProject(removeBtn.dataset.id);
        if (state.projectEditingId === removeBtn.dataset.id) {
          clearProjectForm();
        }
        render();
      }
    });
  }

  el("saveOverrideBtn").addEventListener("click", () => {
    if (!state.overrideTargetKey) {
      el("overrideSelection").textContent = "Select a transaction first.";
      return;
    }
    saveOverrideForTarget();
  });

  el("clearOverrideBtn").addEventListener("click", () => {
    const key = state.overrideTargetKey;
    if (key) {
      delete state.overrides[key];
      saveOverrides();
    }
    clearOverrideForm();
    render();
  });

  el("overrideTableWrap").addEventListener("click", (event) => {
    const editBtn = event.target.closest("button[data-action=\"edit-override\"]");
    const removeBtn = event.target.closest("button[data-action=\"remove-override\"]");
    if (editBtn) {
      const key = editBtn.dataset.key;
      const tx = state.view.derived.find((item) => item.key === key);
      if (tx) setOverrideTarget(tx);
      return;
    }
    if (removeBtn) {
      const key = removeBtn.dataset.key;
      delete state.overrides[key];
      saveOverrides();
      if (state.overrideTargetKey === key) {
        clearOverrideForm();
      }
      render();
    }
  });

  el("monthSelect").addEventListener("change", () => {
    const insightsSelect = el("insightsMonthSelect");
    if (insightsSelect && insightsSelect.value !== el("monthSelect").value) {
      insightsSelect.value = el("monthSelect").value;
    }
    renderMonthDrilldown();
    renderCharts();
  });

  const insightsMonthSelect = el("insightsMonthSelect");
  if (insightsMonthSelect) {
    insightsMonthSelect.addEventListener("change", () => {
      const monthSelect = el("monthSelect");
      if (monthSelect && monthSelect.value !== insightsMonthSelect.value) {
        monthSelect.value = insightsMonthSelect.value;
      }
      renderMonthDrilldown();
      renderCharts();
    });
  }

  el("txSearch").addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderTransactionsTable();
  });

  el("txFlow").addEventListener("change", (event) => {
    state.filters.flow = event.target.value;
    renderTransactionsTable();
  });

  el("txCategory").addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    renderTransactionsTable();
  });

  el("txTag").addEventListener("change", (event) => {
    state.filters.tag = event.target.value;
    renderTransactionsTable();
  });

  el("txMinAmount").addEventListener("input", (event) => {
    state.filters.minAmount = event.target.value;
    renderTransactionsTable();
  });

  el("txMaxAmount").addEventListener("input", (event) => {
    state.filters.maxAmount = event.target.value;
    renderTransactionsTable();
  });

  el("txMonth").addEventListener("change", (event) => {
    state.filters.month = event.target.value;
    renderTransactionsTable();
  });

  el("showExcluded").addEventListener("change", (event) => {
    state.filters.showExcluded = event.target.checked;
    renderTransactionsTable();
  });

  bindTransactionTableEvents("txTableWrap");
  bindTransactionTableEvents("highValueTableWrap");
}

loadState();
render();
bindEvents();
bindSectionNav();
