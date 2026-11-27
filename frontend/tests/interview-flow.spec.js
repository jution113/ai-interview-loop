import { expect, test } from '@playwright/test';

async function startFromSetup(page, seconds = '60') {
  await page.goto('/');
  const file = { name: 'sample.txt', mimeType: 'text/plain', buffer: Buffer.from('Fictional') };
  await page.locator('#application').setInputFiles(file);
  await page.locator('#research').setInputFiles(file);
  await page.getByLabel('답변 제한 시간').selectOption(seconds);
  await click(page, '면접 시작');
  await expect(page.locator('#phase')).toHaveText('준비');
}

function click(page, name) {
  return page.getByRole('button', { name, exact: true }).click();
}

test('TC-05 shows the question and preparation timer with escalating warnings', async ({ page }) => {
  await page.clock.install();
  await startFromSetup(page);
  await expect(page.locator('#question-number')).toHaveText('1번 질문');
  await expect(page.locator('#question')).not.toBeEmpty();
  const timer = page.locator('#timer');
  await expect(timer).toHaveText('00:10');
  await expect(page.getByText(/전체 질문|남은 질문|핵심 질문|꼬리질문|평가 영역|설정으로 돌아가기|모의 재생 완료/)).toHaveCount(0);
  await page.clock.fastForward(7_100);
  for (const [seconds, color] of [[3, '253, 232, 231'], [2, '249, 183, 180'], [1, '180, 35, 24']]) {
    await expect(timer).toHaveText(`00:0${seconds}`);
    await expect(timer).toHaveCSS('background-color', `rgb(${color})`);
    if (seconds > 1) await page.clock.fastForward(1_000);
  }
});

test('TC-06 supports early and automatic transitions without moving the controls', async ({ page }) => {
  await page.clock.install();
  for (const early of [true, false]) {
    await startFromSetup(page, early ? '90' : '60');
    const answerAction = page.locator('#answer-action');
    const meter = page.locator('#volume-placeholder');
    const buttonPosition = await answerAction.boundingBox();
    const meterPosition = await meter.boundingBox();
    const question = await page.locator('#question').textContent();
    if (early) await click(page, '바로 답변');
    else await page.clock.fastForward(10_100);

    await expect(page.locator('#phase')).toHaveText('답변');
    await expect(page.locator('#timer')).toHaveText(early ? '01:30' : '01:00');
    await expect(answerAction).toHaveText('답변 완료');
    await expect(answerAction).toBeEnabled();
    await expect(page.getByRole('button', { name: '바로 답변', exact: true })).toHaveCount(0);
    const timerPosition = await page.locator('#timer').boundingBox();
    const questionPosition = await page.locator('#question').boundingBox();
    const endPosition = await page.getByRole('button', { name: '면접 종료' }).boundingBox();
    expect(timerPosition.x).toBeGreaterThan(questionPosition.x);
    expect(buttonPosition.y).toBeGreaterThan(timerPosition.y);
    expect(endPosition.y).toBeGreaterThan(buttonPosition.y);
    expect(await answerAction.boundingBox()).toEqual(buttonPosition);
    expect(await meter.boundingBox()).toEqual(meterPosition);
    await expect(page.locator('#question')).toHaveText(question);
    await expect(page.locator('#capture')).toBeVisible();

    if (early) await click(page, '답변 완료');
    else await page.clock.fastForward(60_100);
    await expect(page.locator('#phase')).toHaveText('준비');
    await expect(page.locator('#question-number')).toHaveText('2번 질문');
    await expect(page.locator('#capture')).toBeHidden();
    const state = await page.request.get('/api/interviews/' + new URL(page.url()).searchParams.get('id'));
    expect(await state.json()).toMatchObject({ phase: 'PREPARING', acceptedAnswers: 1, version: 3 });
  }
});

test('TC-07 restores both countdowns after a reload', async ({ page }) => {
  await startFromSetup(page, '120');
  const timer = page.locator('#timer');
  await expect(timer).toHaveText('00:09');
  await page.reload();
  await expect(page.locator('#phase')).toHaveText('준비');
  await expect(timer).toHaveText(/^00:0[1-9]$/);
  await expect(page.locator('#question-number')).toHaveText('1번 질문');

  await click(page, '바로 답변');
  await expect(timer).toHaveText('01:59');
  await page.reload();
  await expect(page.locator('#phase')).toHaveText('답변');
  await expect(page.locator('#question-number')).toHaveText('1번 질문');
  await expect(timer).toHaveText(/^01:5[0-9]$/);
  await expect(page.locator('#capture')).toBeVisible();
});

test('TC-08 requests evaluation after normal completion only', async ({ page }) => {
  await startFromSetup(page);
  for (const number of [1, 2]) {
    await expect(page.locator('#question-number')).toHaveText(`${number}번 질문`);
    await click(page, '바로 답변');
    await click(page, '답변 완료');
  }
  await expect(page.locator('#phase')).toHaveText('면접을 완료했습니다.');
  await expect(page.getByRole('heading', { name: '면접 분석' })).toBeVisible();
  await expect(page.locator('#evaluation')).toContainText('모의 평가를 요청했습니다.');
  await expect(page.getByRole('button', { name: '모의 분석 완료' })).toHaveCount(0);

  await startFromSetup(page);
  await click(page, '면접 종료');
  await expect(page.locator('#phase')).toHaveText('면접을 직접 종료했습니다.');
  await expect(page.locator('#evaluation')).toBeHidden();
});
