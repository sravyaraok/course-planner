const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const { chromium } = require('playwright-core');

test('area selection replaces previous course highlights', async (t) => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(__dirname, '../dist/index.html')).href);
  await page.waitForSelector('.chip');

  const initial = await page.evaluate(() => ({
    plan: JSON.parse(localStorage.getItem('course-planner:v1')).plans[0],
    totals: [...document.querySelectorAll('.pg-sem-total')].map((el) => el.textContent),
  }));
  const firstChip = await page.locator('.chip').first().elementHandle();

  async function checkSelection(area) {
    const actual = await page.evaluate(() => ({
      highlighted: [...document.querySelectorAll('.chip-hl')].map((el) => el.dataset.course).sort(),
      dimmed: [...document.querySelectorAll('.chip-dim')].map((el) => el.dataset.course).sort(),
      selected: [...document.querySelectorAll('.pg-area-btn[aria-pressed="true"]')]
        .map((el) => el.dataset.area),
      rows: [...document.querySelectorAll('.pg-row-hl .pg-area-btn')].map((el) => el.dataset.area),
      conflicting: document.querySelectorAll('.chip-hl.chip-dim').length,
      bannerHidden: document.querySelector('.pg-highlight').hidden,
      courses: [...document.querySelectorAll('.chip')].map((el) => el.dataset.course),
      totals: [...document.querySelectorAll('.pg-sem-total')].map((el) => el.textContent),
    }));
    const expected = initial.plan.courseList
      .filter((entry) => area && entry.areas.includes(area))
      .map((entry) => entry.courseId).sort();
    assert.deepEqual(actual.highlighted, expected);
    assert.deepEqual(actual.dimmed, area ? initial.plan.courseList
      .filter((entry) => !entry.areas.includes(area))
      .map((entry) => entry.courseId).sort() : []);
    assert.deepEqual(actual.selected, area ? [area] : []);
    assert.deepEqual(actual.rows, actual.selected);
    assert.equal(actual.conflicting, 0);
    assert.equal(actual.bannerHidden, !area);
    assert.equal(actual.courses.length, initial.plan.courseList.length);
    assert.equal(new Set(actual.courses).size, actual.courses.length);
    assert.deepEqual(actual.totals, initial.totals);
    assert.equal(await firstChip.evaluate((el) => el.isConnected), true);
  }

  for (const area of ['Liberal Studies', 'CS Major', 'Math', 'Liberal Studies', 'ROTC (w/ LS Credit)', 'Robotics Minor']) {
    await page.locator(`.pg-area-btn[data-area=${JSON.stringify(area)}]`).click();
    await checkSelection(area);
  }
  await page.locator('.pg-area-btn[data-area="Robotics Minor"]').click();
  await checkSelection(null);
  await page.locator('.pg-area-btn[data-area="Math"]').click();
  await page.keyboard.press('Escape');
  await checkSelection(null);
  await page.locator('.pg-area-btn[data-area="Math"]').click();
  await page.locator('[data-action="clear-highlight"]').click();
  await checkSelection(null);
  assert.deepEqual(errors, []);
});
