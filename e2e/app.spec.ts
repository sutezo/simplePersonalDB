// E2E smoke tests: create an entry through the UI and verify list filtering.
import { expect, test } from '@playwright/test';

test('creates an entry and shows it in the list', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'PersonalDB' })).toBeVisible();

	await page.getByRole('button', { name: '＋ 新規' }).click();
	await page.getByLabel('タグ（スペース区切り）').fill('e2e test');
	await page.getByLabel('項目 *').fill('Playwright entry');
	await page.getByLabel('値').fill('value-1');
	await page.getByRole('button', { name: '保存' }).click();

	await expect(page.getByText('Playwright entry')).toBeVisible();

	await page.getByPlaceholder('キーワード検索（項目・値・メモ）').fill('no-such-keyword');
	await expect(page.getByText('条件に一致するデータがありません。')).toBeVisible();
});

test('runs a SELECT query on the SQL screen', async ({ page }) => {
	await page.goto('/sql');
	await page.getByRole('button', { name: '実行' }).click();
	await expect(page.getByText(/行|0件/)).toBeVisible();
});
