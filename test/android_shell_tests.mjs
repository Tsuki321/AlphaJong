// Execute the APK's actual document-start template and touch adapter with the public userscript.
// No account or game connection is used. Native WebView behavior is a separate Android check.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const bundlePath = process.env.ALPHAJONG_UNITY_BUNDLE || 'AlphaJong.user.js';
const bundle = await readFile(bundlePath, 'utf8');
const template = await readFile('android/app/src/main/assets/document-start.js', 'utf8');
const mobile = await readFile('android/app/src/main/assets/mobile-controls.js', 'utf8');
const kotlinInjection = await readFile('android/app/src/main/java/com/alphajong/shell/ScriptInjection.kt', 'utf8');
const restore = kotlinInjection.match(/const val RESTORE_CONTROLS = "([^"]+)"/)?.[1];
assert.ok(restore, 'The APK exposes its restore-controls command');
const hash = createHash('sha256').update(bundle).digest('hex');
const injection = template.replaceAll('__ALPHAJONG_HASH__', hash)
  .replace('/*__ALPHAJONG_MOBILE_CONTROLS__*/', () => mobile)
  .replace('/*__ALPHAJONG_USERSCRIPT__*/', () => bundle);
const url = 'https://mahjongsoul.game.yo-star.com/';
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <style>html,body{margin:0;width:100%;height:100%}</style>
  <script>window.__hookWasEarly = WebSocket !== window.__nativeSocket;</script>
  <canvas id="unity-canvas"></canvas>`;
const report = { passed: false, checkedAt: new Date().toISOString(), bundlePath, bundleSha256: hash, scenarios: [] };
await mkdir('test-results', { recursive: true });
let browser;

try {
  browser = await chromium.launch({ headless: true, args: [`--log-file=${path.resolve('test-results/android-chromium.log')}`] });
  for (const [name, viewport] of [['portrait', { width: 393, height: 851 }], ['landscape', { width: 851, height: 393 }]]) {
    const result = { name, checks: 0, errors: [] };
    report.scenarios.push(result);
    const check = (value, description) => { assert.ok(value, `${name}: ${description}`); result.checks++; };
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await context.route('**/*', route => route.request().url() === url
      ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.addInitScript({ content: `
      window.__nativeSocket = window.WebSocket;
      window.__nativeReports = [];
      window.AlphaJongAndroidStatus = { postMessage(value) { window.__nativeReports.push(JSON.parse(value)); } };
      localStorage.setItem('alphajongHintPos', JSON.stringify({ left: 99999, top: 99999 }));
      ${injection}
    ` });
    const page = await context.newPage();
    page.on('pageerror', error => result.errors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__alphaJongAndroidShell?.ready, undefined, { timeout: 10000 });
    check(await page.evaluate(() => window.__hookWasEarly), 'WebSocket hook precedes the first game script');
    check(await page.evaluate(() => WebSocket.prototype === window.__nativeSocket.prototype), 'native WebSocket prototype is preserved');
    check(await page.evaluate(expected => window.__nativeReports.some(message => message.type === 'ready' && message.sha256 === expected), hash), 'native startup acknowledgment identifies the installed script');
    check(!await page.evaluate(() => window.__nativeReports.some(message => message.type === 'error')), 'no startup failure was reported');

    const hide = page.getByRole('button', { name: 'Hide GUI', exact: true });
    await hide.tap();
    check(!await hide.isVisible(), 'hide controls still works');
    check(await page.evaluate(restore), 'the native toolbar command restores controls without a keyboard');
    check(await hide.isVisible(), 'restored controls are visible');

    await page.getByRole('button', { name: 'Hints', exact: true }).tap();
    const header = page.getByText('AlphaJong Hints', { exact: true }).locator('..');
    const panel = header.locator('..');
    await page.waitForFunction(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.x >= 7 && bounds.y >= 7 && bounds.right <= innerWidth - 7 && bounds.bottom <= innerHeight - 7;
    }, await panel.elementHandle());
    check(true, 'an old off-screen saved position is clamped into view');

    const before = await panel.boundingBox();
    const handle = await page.getByText('AlphaJong Hints', { exact: true }).boundingBox();
    const cdp = await context.newCDPSession(page);
    const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 12 * step, y: y - 8 * step }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await panel.boundingBox();
    check(Math.abs(after.x - before.x) > 5 || Math.abs(after.y - before.y) > 5, 'a real touch gesture moves the hints panel');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alphajongHintPos')));
    check(Math.abs(saved.left - after.x) < 1 && Math.abs(saved.top - after.y) < 1, 'the final touch position is saved');

    await page.getByRole('button', { name: '×', exact: true }).tap();
    await page.waitForFunction(element => getComputedStyle(element).display === 'none', await panel.elementHandle(), { timeout: 2000 });
    check(!await panel.isVisible(), 'the close button works after a touch drag');

    await page.getByRole('button', { name: 'Hints', exact: true }).tap();
    await page.setViewportSize({ width: 320, height: 240 });
    await page.waitForFunction(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.x >= 7 && bounds.y >= 7 && bounds.right <= innerWidth - 7 && bounds.bottom <= innerHeight - 7;
    }, await panel.elementHandle());
    check(true, 'rotation or a smaller viewport keeps the panel reachable');
    check(result.errors.length === 0, `no JavaScript errors: ${result.errors.join('; ')}`);
    await page.screenshot({ path: `test-results/android-${name}.png`, fullPage: true });
    result.passed = true;
    await context.close();
  }
  report.passed = true;
  console.log(`Android shell browser checks passed: ${report.scenarios.reduce((total, item) => total + item.checks, 0)} checks across portrait and landscape.`);
} catch (error) {
  report.error = error.stack || String(error);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  if (browser) await browser.close();
  await writeFile('test-results/android-shell.json', JSON.stringify(report, null, 2));
}
