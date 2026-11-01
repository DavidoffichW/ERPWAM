import { writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { preparePlanningWorkbook } from '../../src/web/adapters/excel';
import { qualifiedDataset, workbookFor } from '../helpers/planning';

async function createWorkbookFixture(testInfo: TestInfo): Promise<string> {
  const path = testInfo.outputPath('planning-fixture.xlsx');
  const exported = await preparePlanningWorkbook(workbookFor(await qualifiedDataset()));
  await writeFile(path, exported.bytes);
  return path;
}

async function openEmptyApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Open a planning workbook' })).toBeVisible();
}

async function loadFacilitiesExample(page: Page): Promise<void> {
  await page.getByText('Examples', { exact: true }).click();
  await page.getByRole('button', { name: 'Facilities example' }).click();
  await expect(page.getByRole('heading', { name: 'Facilities example' })).toBeVisible();
}

test('imports, exports, reimports, and persists a planning workbook', async ({ page }, testInfo) => {
  const fixture = await createWorkbookFixture(testInfo);
  await openEmptyApp(page);

  await page.locator('input[type="file"][accept*=".xlsx"]').first().setInputFiles(fixture);
  await expect(page.locator('.app-notice')).toContainText('imported with 1 worksheet');
  await expect(page.getByLabel('Current plan').locator('option:checked')).toHaveText('planning-fixture');
  await expect(page.getByText('Facilities Plan', { exact: true }).first()).toBeVisible();
  await expect(page.getByPlaceholder('Search 18 rows')).toBeVisible();
  const costCell = page.getByRole('gridcell', { name: '950', exact: true });
  await costCell.click();
  await costCell.press('Enter');
  const editor = page.locator('.ag-cell-inline-editing input');
  await editor.fill('951');
  await editor.press('Enter');
  await expect(page.getByRole('gridcell', { name: '951', exact: true })).toBeVisible();
  await expect(page.getByText('Unsaved edits')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const exported = await download;
  const exportedPath = testInfo.outputPath('exported-round-trip.xlsx');
  await exported.saveAs(exportedPath);
  await expect(page.locator('.app-notice')).toContainText('Workbook exported');
  await expect(page.locator('.save-status')).toHaveText('Saved locally');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: '951', exact: true })).toBeVisible();
  await page.locator('input[type="file"][accept*=".xlsx"]').first().setInputFiles(exportedPath);
  await expect(page.locator('.app-notice')).toContainText('imported with 1 worksheet');
  await expect(page.getByLabel('Current plan').locator('option')).toHaveCount(3);
  await expect(page.getByRole('gridcell', { name: '951', exact: true })).toBeVisible();
});

test('keeps manual choice primary, records a ranked decision, and builds a feasible portfolio', async ({ page }) => {
  await openEmptyApp(page);
  await loadFacilitiesExample(page);

  await page.getByRole('button', { name: 'Recommendations' }).click();
  await expect(page.getByRole('heading', { name: 'Replace a job' })).toBeVisible();
  await page.getByLabel('Rank by').selectOption('manual');
  await page.getByRole('button', { name: 'Apply ranking' }).click();
  await expect(page.locator('.notice.success').filter({ hasText: 'Manual selection is ready' })).toBeVisible();
  await expect(page.getByText('Manual selection · 17 options')).toBeVisible();

  await page.locator('summary').filter({ hasText: 'Priority lists' }).click();
  await page.getByRole('button', { name: 'Create example priorities' }).click();
  await expect(page.locator('.notice.success').filter({ hasText: 'Example priorities created' })).toBeVisible();
  await page.getByRole('button', { name: 'Apply ranking' }).click();
  await expect(page.locator('.notice.success').filter({ hasText: 'Example priorities applied' })).toBeVisible();
  await page.getByRole('button', { name: 'Use this replacement' }).click();
  await expect(page.locator('.notice.success').filter({ hasText: 'Replacement saved' })).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'Decision history' })).toBeVisible();
  await expect(page.getByLabel('Saved item').locator('option')).toHaveCount(2);

  await page.getByRole('button', { name: 'Portfolio' }).click();
  await page.getByLabel('Ranking source').selectOption({ label: 'Example priorities' });
  await page.getByLabel('Budget').fill('1000000');
  for (const label of ['HVAC capacity', 'Electrical capacity', 'General capacity']) {
    await page.getByLabel(label).fill('1000');
  }
  await page.getByRole('button', { name: 'Build portfolio' }).click();
  await expect(page.locator('.notice.success').filter({ hasText: /portfolio selected/i })).toBeVisible();
  await expect(page.getByText('Exact optimum', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Browser qualification');
  await page.getByLabel('Recorded by').fill('Playwright');
  await page.getByRole('button', { name: 'Save analysis' }).click();
  await expect(page.getByLabel('Saved item').locator('option')).toHaveCount(3);

  await expect(page.locator('.save-status')).toHaveText('Saved locally');
  await page.reload();
  await page.getByRole('button', { name: 'Recommendations' }).click();
  await expect(page.getByLabel('Rank by').locator('option', { hasText: 'Example priorities' })).toHaveCount(1);
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByLabel('Saved item').locator('option')).toHaveCount(3);
  await expect(page.getByLabel('Saved item').locator('option', { hasText: 'Browser qualification' })).toHaveCount(1);
});

test('does not present a ranking from a stale dataset snapshot', async ({ page }) => {
  await openEmptyApp(page);
  await loadFacilitiesExample(page);
  await page.getByRole('button', { name: 'Recommendations' }).click();
  await page.locator('summary').filter({ hasText: 'Priority lists' }).click();
  await page.getByRole('button', { name: 'Create example priorities' }).click();
  await page.getByRole('button', { name: 'Apply ranking' }).click();
  await expect(page.locator('.notice.success').filter({ hasText: 'Example priorities applied' })).toBeVisible();

  await page.getByRole('button', { name: 'Planning Data' }).click();
  const costCell = page.getByRole('gridcell', { name: '950', exact: true });
  await costCell.click();
  await costCell.press('Enter');
  const editor = page.locator('.ag-cell-inline-editing input');
  await editor.fill('975');
  await editor.press('Enter');
  await page.getByRole('button', { name: 'Recommendations' }).click();
  await expect(page.getByText('Not applied · 17 options', { exact: true })).toBeVisible();
});

test('exports and restores complete browser-local state', async ({ page }, testInfo) => {
  await openEmptyApp(page);
  await loadFacilitiesExample(page);
  await expect(page.locator('.save-status')).toHaveText('Saved locally');

  await page.getByLabel('Open data and settings menu').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export local backup' }).click();
  const backup = await download;
  const backupPath = testInfo.outputPath('erpwam-backup.json');
  await backup.saveAs(backupPath);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete all local data' }).click();
  await expect(page.getByRole('heading', { name: 'Open a planning workbook' })).toBeVisible();

  await page.getByLabel('Open data and settings menu').click();
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath);
  await expect(page.locator('.app-notice')).toContainText('Local backup restored');
  await expect(page.getByRole('heading', { name: 'Facilities example' })).toBeVisible();
});

test('shows controlled workbook and browser-storage failures', async ({ browser }, testInfo) => {
  const invalidPath = testInfo.outputPath('invalid.xlsx');
  await writeFile(invalidPath, new Uint8Array([1, 2, 3, 4]));

  const normalPage = await browser.newPage();
  await openEmptyApp(normalPage);
  await normalPage.locator('input[type="file"][accept*=".xlsx"]').first().setInputFiles(invalidPath);
  await expect(normalPage.getByRole('alert')).toContainText(/valid XLSX|ZIP container/i);
  await normalPage.close();

  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
  });
  const failedStoragePage = await context.newPage();
  await failedStoragePage.goto('/');
  await expect(failedStoragePage.getByRole('alert')).toContainText('IndexedDB is unavailable');
  await expect(failedStoragePage.getByText('Local saving unavailable')).toBeVisible();
  await context.close();
});

test('installs the service worker and reloads the cached application shell offline', async ({ page, context }) => {
  await openEmptyApp(page);
  await loadFacilitiesExample(page);
  await expect(page.locator('.save-status')).toHaveText('Saved locally');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      void navigator.serviceWorker.getRegistration().then((registration) => registration?.active?.postMessage({ type: 'SKIP_WAITING' }));
    });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Facilities example' })).toBeVisible();
  await page.getByRole('button', { name: 'Recommendations' }).click();
  await expect(page.getByRole('heading', { name: 'Replace a job' })).toBeVisible();
  await context.setOffline(false);
});

test('keeps the compact workspace responsive, keyboard-accessible, and clearly labelled', async ({ page }, testInfo) => {
  await openEmptyApp(page);

  const helpButton = page.getByRole('button', { name: 'Open help' });
  await helpButton.click();
  await expect(page.getByRole('dialog', { name: 'Planning help' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Planning help' })).toBeHidden();
  await expect(helpButton).toBeFocused();

  await loadFacilitiesExample(page);
  await expect(page.getByRole('button', { name: 'Undo cell edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Redo cell edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();

  const mappingSummary = page.locator('summary').filter({ hasText: 'Column mapping' });
  await expect(mappingSummary).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(mappingSummary).toBeFocused();
  await expect(mappingSummary.locator('xpath=..')).not.toHaveAttribute('open', '');
  const issuesSummary = page.locator('summary').filter({ hasText: 'Data issues' });
  await issuesSummary.click();
  await expect(page.getByLabel('Data-quality issues')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(issuesSummary).toBeFocused();

  const settings = page.getByLabel('Open data and settings menu');
  await settings.click();
  await expect(page.getByRole('button', { name: 'Export local backup' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Export local backup' })).toBeHidden();
  await expect(settings).toBeFocused();

  const themeButton = page.getByRole('button', { name: 'Switch to light theme' });
  await themeButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

  for (const [view, heading] of [['Recommendations', 'Replace a job'], ['Portfolio', 'Portfolio'], ['History', 'Decision history'], ['Overview', 'Overview']] as const) {
    await page.getByRole('button', { name: view }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: testInfo.outputPath(`overview-${viewport.width}x${viewport.height}.png`), fullPage: true });
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});
