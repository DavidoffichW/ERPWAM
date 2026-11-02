import { expect, test } from '@playwright/test';

test('completes the analytical first-use workflow and reopens the saved project', async ({ page }) => {
  test.setTimeout(60_000);
  const externalRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Understand how assets and resources perform over time.' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/synthetic|fictional|fake/i);
  await page.getByRole('button', { name: 'Open example workspace' }).click();

  await expect(page.getByTestId('overview-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Asset performance' })).toBeVisible();
  await expect(page.getByText('Observation coverage')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/synthetic|fictional|fake/i);

  const scatter = page.locator('.chart-panel').filter({ has: page.getByRole('heading', { name: 'Availability and utilization' }) }).locator('.chart');
  await scatter.focus();
  await scatter.press('ArrowRight');
  await expect(page.getByRole('status').filter({ hasText: /Selected JW-/ })).toBeVisible();

  await page.getByRole('button', { name: /JW-/ }).first().click();
  await expect(page.getByTestId('assets-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Observed history' })).toBeVisible();

  await page.getByRole('button', { name: 'Analytics' }).click();
  await expect(page.getByTestId('analytics-page')).toBeVisible();
  await expect(page.getByText('Sample standard deviation')).toBeVisible();

  await page.getByRole('button', { name: 'Forecasts' }).click();
  await page.getByRole('button', { name: 'Run backtest' }).click();
  await expect(page.getByRole('heading', { name: 'Forecast output' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTitle('Mean absolute held-out error')).toBeVisible();
  await expect(page.getByText('Empirical interval check')).toBeVisible();
  await expect(page.getByText(/admitted folds · \d+ excluded/)).toBeVisible();

  await page.getByRole('button', { name: 'Scenarios' }).click();
  await page.getByRole('button', { name: 'Apply scenario' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario evidence' })).toBeVisible();
  await expect(page.getByText('SCENARIO').first()).toBeVisible();

  await page.getByRole('button', { name: 'Data' }).click();
  await expect(page.locator('body')).not.toContainText(/synthetic|fictional|fake/i);
  await page.getByRole('button', { name: 'Save locally' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Project saved' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export verified project' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('erpwam-juniper-works-project.json');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Saved workspaces' })).toBeVisible();
  await page.getByRole('button', { name: /Juniper Works analysis/ }).click();
  await expect(page.getByTestId('data-page')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Project reopened.' })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete local project' }).click();
  await expect(page.getByRole('heading', { name: 'Understand how assets and resources perform over time.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Local project deleted.' })).toBeVisible();
  await expect(page.getByText('Juniper Works analysis')).toHaveCount(0);

  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('Playwright did not retain the exported project file.');
  await page.locator('input[type="file"]').setInputFiles(downloadPath);
  await expect(page.getByTestId('data-page')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Project imported and checked.' })).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('keeps the workspace usable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open example workspace' }).click();
  await expect(page.getByTestId('overview-page')).toBeVisible();
  await page.getByRole('button', { name: 'Assets' }).click();
  await expect(page.getByTestId('assets-page')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Forecasts' }).click();
  await page.getByRole('button', { name: 'Run backtest' }).click();
  await expect(page.getByRole('heading', { name: 'Forecast output' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('reloads the cached application shell offline after first use', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open example workspace' }).click();
  await expect(page.getByTestId('overview-page')).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, { timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Understand how assets and resources perform over time.' })).toBeVisible();
  await context.setOffline(false);
});

test('leaves the historical planning database untouched', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('erp-local-application', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('application-state');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('application-state', 'readwrite');
        transaction.objectStore('application-state').put({ historical: true }, 'current');
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });

  await page.getByRole('button', { name: 'Open example workspace' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  const historical = await page.evaluate(async () => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('erp-local-application', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('application-state', 'readonly');
      const read = transaction.objectStore('application-state').get('current');
      read.onsuccess = () => { database.close(); resolve(read.result); };
      read.onerror = () => reject(read.error);
    };
  }));
  expect(historical).toEqual({ historical: true });
});

test('fails closed when browser-local analytical state is corrupted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open example workspace' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'ERPWAM' }).click();
  await page.evaluate(async () => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('erpwam-analytics-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('analytical-projects', 'readwrite');
      const store = transaction.objectStore('analytical-projects');
      const read = store.get('project-juniper-works');
      read.onerror = () => reject(read.error);
      read.onsuccess = () => {
        const project = read.result;
        project.dataset.observations[0].assetId = 'corrupted-asset';
        store.put(project);
      };
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }));

  await page.getByRole('button', { name: /Juniper Works analysis/ }).click();
  await expect(page.getByRole('alert')).toContainText('unknown asset or metric');
  await expect(page.getByRole('heading', { name: 'Saved workspaces' })).toBeVisible();
});
