import { expect, test } from '@playwright/test';

test('completes the analytical first-use workflow and reopens the saved project', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Understand how assets and resources perform over time.' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore fictional dataset' }).click();

  await expect(page.getByTestId('overview-page')).toBeVisible();
  await expect(page.getByText('Fictional dataset').first()).toBeVisible();
  await expect(page.getByText('Observation coverage')).toBeVisible();

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
  await expect(page.getByText('Mean absolute held-out error')).toBeVisible();

  await page.getByRole('button', { name: 'Scenarios' }).click();
  await page.getByRole('button', { name: 'Apply scenario' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario evidence' })).toBeVisible();
  await expect(page.getByText('SCENARIO').first()).toBeVisible();

  await page.getByRole('button', { name: 'Data' }).click();
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
  await expect(page.getByRole('status').filter({ hasText: 'Local project reopened.' })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete local project' }).click();
  await expect(page.getByRole('heading', { name: 'Understand how assets and resources perform over time.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Local project deleted.' })).toBeVisible();
  await expect(page.getByText('Juniper Works analysis')).toHaveCount(0);
});

test('keeps the workspace usable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore fictional dataset' }).click();
  await expect(page.getByTestId('overview-page')).toBeVisible();
  await page.getByRole('button', { name: 'Assets' }).click();
  await expect(page.getByTestId('assets-page')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('reloads the cached application shell offline after first use', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore fictional dataset' }).click();
  await expect(page.getByTestId('overview-page')).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, { timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Understand how assets and resources perform over time.' })).toBeVisible();
  await context.setOffline(false);
});
