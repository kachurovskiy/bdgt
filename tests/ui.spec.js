const path = require('path');
const { test, expect } = require('@playwright/test');

const fileUrl = `file://${path.resolve(__dirname, '../index.html')}`;
const fixtureDir = path.resolve(__dirname, 'fixtures');
const csvPath = path.join(fixtureDir, 'transactions.csv');
const comdirectPath = path.join(fixtureDir, 'comdirect.csv');

async function importCsv(page, filePath = csvPath) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('#importBtn');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
  await expect(page.locator('#importStatus')).toContainText('records found');
}

async function restoreJson(page, payload) {
  await page.evaluate(async (backupPayload) => {
    const file = new File([JSON.stringify(backupPayload)], 'bdgt-backup.json', {
      type: 'application/json'
    });
    await importJSON(file);
  }, payload);
}

async function openSection(page, sectionId) {
  await page.click(`#nav-${sectionId}`);
}

async function getExcludedCount(page) {
  const badgesText = await page.locator('#summaryBadges').innerText();
  const match = badgesText.match(/Excluded:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(fileUrl);
});

test('renders English UI', async ({ page }) => {
  await expect(page).toHaveTitle('BDGT - instant budget app');
});

test('imports CSV and shows summary', async ({ page }) => {
  await importCsv(page);
  await openSection(page, 'insights');
  await expect(page.locator('#summaryBadges')).toContainText('Budgeted:');
  await expect(page.locator('#summaryStats .border')).toHaveCount(3);
  await expect(page.locator('#yearlyChart')).toBeVisible();
  await expect(page.locator('#monthlyChart')).toBeVisible();
  await expect(page.locator('#categoryChart')).toBeVisible();
});

test('imports comdirect CSV', async ({ page }) => {
  await importCsv(page, comdirectPath);
  await openSection(page, 'transactions');
  await expect(page.locator('#txTableWrap tr[data-key]').first()).toBeVisible();
});

test('adds a manual override and exclusion', async ({ page }) => {
  await importCsv(page);

  await openSection(page, 'insights');
  const beforeExcluded = await getExcludedCount(page);

  await openSection(page, 'transactions');
  await page.locator('#txTableWrap tr[data-key]').first().click();
  await page.locator('#txTableWrap .tx-category-select').first().selectOption('House');

  await openSection(page, 'overrides');
  await page.check('#overrideExclude');
  await page.click('#saveOverrideBtn');

  await openSection(page, 'transactions');
  await expect(page.locator('#txTableWrap .tx-category-select').first()).toHaveValue('House');
  await openSection(page, 'insights');
  const afterExcluded = await getExcludedCount(page);
  expect(afterExcluded).toBeGreaterThan(beforeExcluded);
});

test('adds an auto-categorization rule', async ({ page }) => {
  await importCsv(page);

  await openSection(page, 'rules');
  await page.fill('#expenseRuleKeyword', 'netflix');
  await page.selectOption('#expenseRuleCategory', 'Travel');
  await page.click('#addExpenseRuleBtn');

  await expect(page.locator('#expenseRuleTableWrap')).toContainText('netflix');

  await openSection(page, 'transactions');
  await page.fill('#txSearch', 'netflix');
  await expect(page.locator('#txTableWrap .tx-category-select').first()).toHaveValue('Travel');
});

test('proposes rules from repeated keywords', async ({ page }) => {
  await importCsv(page);

  await openSection(page, 'proposed');
  await expect(page.locator('#proposalTableWrap')).not.toContainText('No proposed rules');
  await expect(page.locator('#proposalTableWrap button[data-action="apply-proposal"]').first()).toBeVisible();
});

test('shows excluded transactions table', async ({ page }) => {
  await importCsv(page);

  await openSection(page, 'highvalue');
  await page.fill('#exclusionThreshold', '1');
  await page.dispatchEvent('#exclusionThreshold', 'change');

  await expect(page.locator('#highValueTableWrap')).toContainText('Amount');
  await expect(page.locator('#highValueTableWrap tr[data-key]').first()).toBeVisible();
});

test('adds exclusion rule and hides excluded from transactions', async ({ page }) => {
  await importCsv(page);

  await openSection(page, 'highvalue');
  await page.fill('#exclusionRuleKeyword', 'amazon');
  await page.click('#addExclusionRuleBtn');

  await expect(page.locator('#exclusionRuleTableWrap')).toContainText('amazon');
  await expect(page.locator('#highValueTableWrap')).toContainText('Rule: amazon');

  await openSection(page, 'transactions');
  await page.fill('#txSearch', 'amazon');
  await page.uncheck('#showExcluded');

  await expect(page.locator('#txTableWrap')).toContainText('No results');
});

test('exclusion threshold updates excluded count', async ({ page }) => {
  await importCsv(page);

  await openSection(page, 'highvalue');
  await page.fill('#exclusionThreshold', '1');
  await page.dispatchEvent('#exclusionThreshold', 'change');

  await openSection(page, 'insights');
  const excludedCount = await getExcludedCount(page);
  expect(excludedCount).toBeGreaterThan(0);
});

test('creates project with chart and can finish it', async ({ page }) => {
  await importCsv(page);

  await openSection(page, 'projects');
  await page.fill('#projectName', 'DIY');
  await page.fill('#projectKeywords', 'amazon');
  await page.click('#saveProjectBtn');

  await expect(page.locator('#projectsWrap')).toContainText('DIY');
  await expect(page.locator('#projectsWrap canvas').first()).toBeVisible();

  await page.locator('#projectsWrap button[data-action="toggle-project"]').first().click();
  await expect(page.locator('#projectsWrap')).toContainText('Finished');
});

test('backup, restore, database overview, and clear stay scoped to app data', async ({ page }) => {
  await importCsv(page);
  await openSection(page, 'setup');
  await expect(page.locator('#dbOverviewTable')).toContainText('Transactions');
  await expect(page.locator('#dbOverviewStatus')).toContainText('key');

  const backup = await page.evaluate(() => buildBackupPayload());
  expect(backup.version).toBe(2);
  expect(Object.keys(backup.stores)).toContain('bdgt.transactions.v1');

  await page.evaluate(() => {
    localStorage.setItem('other-app.setting', 'keep');
    localStorage.removeItem('bdgt.transactions.v1');
  });

  await restoreJson(page, backup);
  await expect(page.locator('#importStatus')).toContainText('Backup restored');
  await openSection(page, 'transactions');
  await expect(page.locator('#txTableWrap tr[data-key]').first()).toBeVisible();

  await openSection(page, 'setup');
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#clearBtn');
  await expect(page.locator('#importStatus')).toContainText('Local data cleared.');
  await expect(page.locator('#dbOverviewStatus')).toContainText('No local data yet.');

  const storageState = await page.evaluate(() => ({
    otherValue: localStorage.getItem('other-app.setting'),
    hasAppKeys: Object.keys(localStorage).some((key) => key.startsWith('bdgt.'))
  }));
  expect(storageState).toEqual({ otherValue: 'keep', hasAppKeys: false });
});
