import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Keep rendering affordable on software GPUs; preserve settings on reload.
    if (!localStorage.getItem('neon-settings')) {
      localStorage.setItem('neon-settings', JSON.stringify({ quality: 'low' }));
    }
  });
});
async function start(page: import('@playwright/test').Page) {
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'INITIALIZE DEFENSE' }).click();
  // The intro expires after 2.2 seconds, so its skip button may disappear
  // while Playwright waits for a stable frame on a software renderer.
  await expect(page.getByRole('button', { name: 'SKIP INTRO' })).toBeHidden();
  await expect(page.getByText('Build your defense.')).toBeVisible();
}
async function selectPad(page: import('@playwright/test').Page, pad: number) { const point = await page.evaluate(p => (window as any).__NEON_TEST__.padPosition(p), pad); await page.mouse.click(point.x, point.y); await expect(page.getByText(`SITE ${String(pad + 1).padStart(2, '0')}`, { exact: true })).toBeVisible(); }
test('construction, upgrades and recycling through the HUD', async ({ page }) => { const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await start(page); await selectPad(page, 3); await page.getByRole('button', { name: 'DEPLOY LASER TURRET' }).click(); await expect(page.getByText('LEVEL 1', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'UPGRADE · 70 CR' }).click(); await expect(page.getByText('LEVEL 2', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'RECYCLE TOWER' }).click(); await expect(page.getByText('Build your defense.')).toBeVisible(); expect(await page.evaluate(() => (window as any).__NEON_TEST__.game.credits)).toBe(299); expect(errors).toEqual([]); });
test('manual wave start, pause/resume, speed and real-time attacks', async ({ page }) => { await start(page); await selectPad(page, 1); await page.getByRole('button', { name: 'DEPLOY LASER TURRET' }).click(); await page.getByRole('button', { name: 'START WAVE 01' }).click(); await page.getByRole('button', { name: 'Game speed 3x' }).click(); await expect.poll(() => page.evaluate(() => (window as any).__NEON_TEST__.game.kills), { timeout: 20000 }).toBeGreaterThan(0); await page.getByRole('button', { name: 'Pause', exact: true }).click(); const before = await page.evaluate(() => (window as any).__NEON_TEST__.game.time); await page.waitForTimeout(250); expect(await page.evaluate(() => (window as any).__NEON_TEST__.game.time)).toBe(before); await page.getByRole('button', { name: 'RESUME DEFENSE' }).click(); await expect.poll(() => page.evaluate(() => (window as any).__NEON_TEST__.game.time)).toBeGreaterThan(before); });
test('camera rotation, zoom, pan and cancellation', async ({ page }) => { await start(page); const before = await page.evaluate(() => (window as any).__NEON_TEST__.scene.camera.position.toArray()); await page.mouse.move(650, 430); await page.mouse.down({ button: 'right' }); await page.mouse.move(770, 430, { steps: 10 }); await page.mouse.up({ button: 'right' }); await page.mouse.wheel(0, -300); await page.keyboard.down('w'); await page.waitForTimeout(200); await page.keyboard.up('w'); await expect.poll(() => page.evaluate(() => (window as any).__NEON_TEST__.scene.camera.zoom)).toBeGreaterThan(1.1); const after = await page.evaluate(() => (window as any).__NEON_TEST__.scene.camera.position.toArray()); expect(after).not.toEqual(before); await page.keyboard.press('Home'); await page.waitForTimeout(800); await selectPad(page, 3); await page.keyboard.press('Escape'); expect(await page.evaluate(() => (window as any).__NEON_TEST__.game.selected)).toBeNull(); });
test('settings persist and quality modes render without runtime errors', async ({ page }) => { const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/?test=1'); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByLabel('Graphics quality').selectOption('low'); await page.getByLabel('Reduced motion').check(); await page.getByRole('button', { name: 'SAVE & RETURN' }).click(); await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await expect(page.getByLabel('Graphics quality')).toHaveValue('low'); await expect(page.getByLabel('Reduced motion')).toBeChecked(); await page.getByLabel('Graphics quality').selectOption('high'); await page.getByRole('button', { name: 'SAVE & RETURN' }).click(); await page.waitForTimeout(300); expect(errors).toEqual([]); });
test('victory, defeat, and fresh restart screens', async ({ page }) => { await start(page); await page.evaluate(() => { const g = (window as any).__NEON_TEST__.game; g.phase = 'combat'; g.wave = 20; g.queue = []; g.enemies = []; g.step(1 / 60); }); await expect(page.getByText('The city lives.', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'DEPLOY AGAIN' }).click(); await page.evaluate(() => { const g = (window as any).__NEON_TEST__.game; g.phase = 'defeat'; g.hp = 0; g.publish(); }); await expect(page.getByText('The lights went out.', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'DEPLOY AGAIN' }).click(); expect(await page.evaluate(() => (window as any).__NEON_TEST__.game.hp)).toBe(20); expect(await page.evaluate(() => (window as any).__NEON_TEST__.game.towers.length)).toBe(0); });

for (const difficulty of ['Easy', 'Medium', 'Hard', 'Hardcore']) {
  test(`${difficulty} selection persists, locks during campaign and survives restart`, async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.getByRole('radio', { name: /^Medium / })).toBeChecked();
    await page.getByRole('radio', { name: new RegExp(`^${difficulty} `) }).check();
    await page.reload();
    await expect(page.getByRole('radio', { name: new RegExp(`^${difficulty} `) })).toBeChecked();
    await page.getByRole('button', { name: 'INITIALIZE DEFENSE' }).click();
    await expect(page.getByRole('button', { name: 'SKIP INTRO' })).toBeHidden();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.locator('.reactor strong')).toHaveText('100%');
    await expect(page.locator('.objective')).toContainText(difficulty === 'Hardcore' ? '10 / 10 HP' : '20 / 20 HP');
    if (difficulty === 'Hardcore') await page.screenshot({ path: 'test-results/hardcore-hud.png' });
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Restart operation' }).click();
    await page.getByRole('button', { name: 'RESTART', exact: true }).click();
    expect(await page.evaluate(() => (window as any).__NEON_TEST__.game.difficulty)).toBe(difficulty.toLowerCase());
    await page.evaluate(() => { const g = (window as any).__NEON_TEST__.game; g.phase = 'defeat'; g.hp = 0; g.wave = 2; g.publish(); });
    await expect(page.locator('.result-difficulty')).toContainText(`${difficulty} difficulty`);
    await page.getByRole('button', { name: 'DEPLOY AGAIN' }).click();
    await expect(page.locator('.reactor strong')).toHaveText('100%');
  });
}
test('invalid selection defaults to Medium and legacy best migrates without reducing Easy best', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('neon-difficulty', 'invalid');
    localStorage.setItem('neon-best', '500');
    localStorage.setItem('neon-bests', JSON.stringify({ easy: 700, hard: 900 }));
  });
  await page.goto('/?test=1');
  await expect(page.getByRole('radio', { name: /^Medium / })).toBeChecked();
  await page.getByRole('radio', { name: /^Easy / }).check();
  await expect(page.locator('.menu-secondary')).toContainText('700');
  await page.getByRole('radio', { name: /^Hard / }).check();
  await expect(page.locator('.menu-secondary')).toContainText('900');
});
test('result scores remain separate and legacy best imports to Easy', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('neon-best', '500'));
  await start(page);
  await page.evaluate(() => { const g = (window as any).__NEON_TEST__.game; g.phase = 'defeat'; g.hp = 0; g.wave = 3; g.kills = 4; g.publish(); });
  await expect(page.locator('.result-difficulty')).toContainText('Personal best 340');
  await page.getByRole('button', { name: 'Return to main menu' }).click();
  await expect(page.locator('.menu-secondary')).toContainText('340');
  await page.getByRole('radio', { name: /^Easy / }).check();
  await expect(page.locator('.menu-secondary')).toContainText('500');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('neon-bests')!))).toEqual({ easy: 500, medium: 340, hard: 0, hardcore: 0 });
  await page.screenshot({ path: 'test-results/difficulty-menu.png' });
});
