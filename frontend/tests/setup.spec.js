import { expect, test } from '@playwright/test';

function fakeFile(name) {
  return { name, mimeType: 'text/plain', buffer: Buffer.from('Fictional test material') };
}

async function chooseRequiredFiles(page) {
  await page.locator('#application').setInputFiles(fakeFile('application.txt'));
  await page.locator('#research').setInputFiles(fakeFile('research.txt'));
}

async function submit(page) {
  await page.getByRole('button', { name: '면접 시작' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('TC-02 submits confirmed required files without a portfolio', async ({ page }) => {
  await expect(page.locator('#application')).toHaveAttribute('required', '');
  await expect(page.locator('#research')).toHaveAttribute('required', '');
  await expect(page.locator('#portfolio')).not.toHaveAttribute('required', '');
  await expect(page.getByText(/모의 상태 · 실제 마이크/)).toBeVisible();
  await chooseRequiredFiles(page);
  await page.locator('#confirmed').check();
  await submit(page);
  await expect(page.getByRole('status')).toHaveText('모의 설정을 확인했습니다. 답변 제한 시간은 60초입니다.');
});

test('TC-03 lists multiple research files and accepts an optional portfolio', async ({ page }) => {
  await page.locator('#research').setInputFiles([fakeFile('company.txt'), fakeFile('role.txt')]);
  await page.locator('#portfolio').setInputFiles(fakeFile('portfolio.txt'));
  await expect(page.locator('#research-files li')).toHaveText(['company.txt', 'role.txt']);
  await expect(page.locator('#portfolio')).toHaveValue(/portfolio\.txt$/);
});

for (const missing of ['application', 'research']) {
  test(`TC-04 blocks submission without ${missing}`, async ({ page }) => {
    await chooseRequiredFiles(page);
    await page.locator(`#${missing}`).setInputFiles([]);
    await submit(page);
    await expect(page.locator(`#${missing}-error`)).toBeVisible();
    await expect(page.getByRole('status')).toBeEmpty();
  });
}

test('TC-05 requires company and role confirmation', async ({ page }) => {
  await chooseRequiredFiles(page);
  await submit(page);
  await expect(page.locator('#confirmed-error')).toBeVisible();
  await expect(page.getByRole('status')).toBeEmpty();
});

test('TC-06 defaults to 60 seconds and submits the last selected duration', async ({ page }) => {
  const duration = page.getByLabel('답변 제한 시간');
  await expect(duration).toHaveValue('60');
  await expect(duration.locator('option')).toHaveText(['60초', '90초', '120초']);
  await expect(page.getByText('질문 수')).toHaveCount(0);
  await chooseRequiredFiles(page);
  await page.locator('#confirmed').check();
  for (const seconds of ['90', '120', '60']) {
    await duration.selectOption(seconds);
    await submit(page);
    await expect(page.getByRole('status')).toContainText(`${seconds}초`);
  }
});

for (const field of ['application', 'research']) {
  for (const action of ['remove', 'replace']) {
    test(`TC-07 requires valid inputs again when users ${action} ${field}`, async ({ page }) => {
      await chooseRequiredFiles(page);
      await page.locator('#confirmed').check();
      await submit(page);
      await expect(page.getByRole('status')).not.toBeEmpty();
      if (action === 'remove') {
        await page.locator(`#${field}-clear`).click();
      } else {
        await page.locator(`#${field}`).setInputFiles(fakeFile('replacement.txt'));
      }
      await expect(page.locator('#confirmed')).not.toBeChecked();
      await expect(page.getByRole('status')).toBeEmpty();
      await submit(page);
      await expect(page.locator(action === 'remove' ? `#${field}-error` : '#confirmed-error')).toBeVisible();
      await expect(page.getByRole('status')).toBeEmpty();
    });
  }
}

test('TC-08 masks the key without sending or persisting it', async ({ page, context }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await chooseRequiredFiles(page);
  await page.locator('#confirmed').check();
  await page.getByLabel('개인 API 키').fill('fictional-setup-test-key');
  await expect(page.getByLabel('개인 API 키')).toHaveAttribute('type', 'password');
  await submit(page);
  await expect(page.getByRole('status')).toContainText('모의 설정');
  expect(requests).toEqual([]);
  const storage = await context.storageState({ indexedDB: true });
  expect(JSON.stringify(storage)).not.toContain('fictional-setup-test-key');
  const sessionData = await page.evaluate(() => JSON.stringify(window.sessionStorage));
  expect(sessionData).not.toContain('fictional-setup-test-key');
});
