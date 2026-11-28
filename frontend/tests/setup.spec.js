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

test('TC-02 starts with both required files and no portfolio', async ({ page }) => {
  await expect(page.locator('#application')).toHaveAttribute('required', '');
  await expect(page.locator('#research')).toHaveAttribute('required', '');
  await expect(page.locator('#portfolio')).not.toHaveAttribute('required', '');
  await expect(page.getByText(/모의 상태 · 실제 마이크/)).toBeVisible();
  await chooseRequiredFiles(page);
  await submit(page);
  await expect(page).toHaveURL(/\/interview\.html\?id=/);
  await expect(page.locator('#phase')).toHaveText('준비');
});

test('TC-03 lists multiple research files and accepts an optional portfolio', async ({ page }) => {
  await page.locator('#research').setInputFiles([fakeFile('company.txt'), fakeFile('role.txt')]);
  await page.locator('#portfolio').setInputFiles(fakeFile('portfolio.txt'));
  await expect(page.locator('#research-files li')).toHaveText(['company.txt', 'role.txt']);
  await expect(page.locator('#portfolio')).toHaveValue(/portfolio\.txt$/);
});

test('clears an optional portfolio and starts with the required files', async ({ page }) => {
  const portfolio = page.locator('#portfolio');
  const clear = page.getByRole('button', { name: '포트폴리오 선택 지우기' });
  await expect(clear).toBeHidden();
  await portfolio.setInputFiles(fakeFile('portfolio.txt'));
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(portfolio).toHaveValue('');
  await expect(clear).toBeHidden();
  await chooseRequiredFiles(page);
  await expect(page.getByRole('button', { name: '면접 시작' })).toBeEnabled();
  await submit(page);
  await expect(page.locator('#phase')).toHaveText('준비');
});

for (const missing of ['application', 'research']) {
  test(`TC-04 blocks submission without ${missing}`, async ({ page }) => {
    await chooseRequiredFiles(page);
    await page.locator(`#${missing}`).setInputFiles([]);
    await submit(page);
    await expect(page.locator(`#${missing}-error`)).toBeVisible();
    await expect(page).toHaveURL('/');
  });
}

test('marks required documents in red without a confirmation section', async ({ page }) => {
  for (const field of ['application', 'research']) {
    const label = page.locator(`label[for="${field}"] small`);
    await expect(label).toHaveText('필수');
    await expect(label).toHaveCSS('color', 'rgb(180, 35, 24)');
  }
  await expect(page.locator('label[for="portfolio"] small')).toHaveText('선택');
  await expect(page.getByRole('heading', { name: '기업·직무 정보 확인' })).toHaveCount(0);
});

test('TC-06 defaults to 60 seconds and submits the last selected duration', async ({ page }) => {
  const duration = page.getByLabel('답변 제한 시간');
  await expect(duration).toHaveValue('60');
  await expect(duration.locator('option')).toHaveText(['60초', '90초', '120초']);
  await expect(page.getByText('질문 수')).toHaveCount(0);
  await chooseRequiredFiles(page);
  await duration.selectOption('90');
  await duration.selectOption('120');
  const [created] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/interviews' && response.status() === 201),
    submit(page),
  ]);
  expect(created.request().postDataJSON()).toEqual({ answerSeconds: 120 });
  await expect(page.locator('#phase')).toHaveText('준비');
});

for (const field of ['application', 'research']) {
  test(`TC-07 blocks a removed ${field} and accepts its replacement`, async ({ page }) => {
    await chooseRequiredFiles(page);
    await page.locator(`#${field}-clear`).click();
    await submit(page);
    await expect(page.locator(`#${field}-error`)).toBeVisible();
    await expect(page).toHaveURL('/');

    await page.locator(`#${field}`).setInputFiles(fakeFile('replacement.txt'));
    await expect(page.locator(`#${field}-error`)).toBeHidden();
    await submit(page);
    await expect(page.locator('#phase')).toHaveText('준비');
  });
}

test('TC-08 masks the key without sending or persisting it', async ({ page, context }) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await chooseRequiredFiles(page);
  await page.getByLabel('개인 API 키').fill('fictional-setup-test-key');
  await expect(page.getByLabel('개인 API 키')).toHaveAttribute('type', 'password');
  await submit(page);
  await expect(page.locator('#phase')).toHaveText('준비');
  const writes = requests.filter(request => request.method() !== 'GET');
  expect(writes.map(request => new URL(request.url()).pathname)).toEqual(['/api/interviews']);
  expect(writes[0].postDataJSON()).toEqual({ answerSeconds: 60 });
  for (const request of requests) {
    expect(request.url()).not.toMatch(/fictional-setup-test-key|application\.txt|research\.txt/);
    expect(JSON.stringify(await request.allHeaders())).not.toContain('fictional-setup-test-key');
  }
  const storage = await context.storageState({ indexedDB: true });
  expect(JSON.stringify(storage)).not.toContain('fictional-setup-test-key');
  const sessionData = await page.evaluate(() => JSON.stringify(window.sessionStorage));
  expect(sessionData).not.toContain('fictional-setup-test-key');
});
