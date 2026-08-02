import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const testFilePath = path.resolve(process.argv[2] || path.join("test", "run_tests.html"));
const testUrl = pathToFileURL(testFilePath).toString();
const maxMsPerTest = Number.parseFloat(process.env.ALPHAJONG_MAX_MS_PER_TEST || "250");
const timeoutMs = Number.parseFloat(process.env.ALPHAJONG_TEST_TIMEOUT_MS || "600000");
const fastMode = process.env.ALPHAJONG_FAST === "1";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleLines = [];
const pageErrors = [];

if (fastMode) {
  // Runs before any page script. Lets the test page skip the slow discard loop and
  // report after only the (fast) regression + prediction unit tests.
  await page.addInitScript(() => {
    window.__ALPHAJONG_FAST = true;
  });
}

page.on("console", (msg) => {
  const line = `[browser:${msg.type()}] ${msg.text()}`;
  consoleLines.push(line);
  if (msg.type() === "error" || msg.type() === "warning") {
    console.log(line);
  }
});

page.on("pageerror", (err) => {
  pageErrors.push(err.message);
  console.error(`[pageerror] ${err.message}`);
});

await page.goto(testUrl, { waitUntil: "load" });

// Note: Playwright's signature is waitForFunction(fn, arg, options). Passing the
// options object as the second argument is treated as the page function's argument,
// silently falling back to the default 30s timeout. Use the explicit 3-arg form.
await page.waitForFunction(() => window.__ALPHAJONG_TEST_DONE === true, undefined, {
  timeout: timeoutMs
});

const result = await page.evaluate(() => window.__ALPHAJONG_TEST_RESULT || null);
await browser.close();

if (!result) {
  throw new Error("Missing test result payload from run_tests.html.");
}

if (pageErrors.length > 0) {
  throw new Error(`Encountered page errors during test execution: ${pageErrors.join(" | ")}`);
}

if (typeof result.failed !== "number" || result.failed > 0) {
  throw new Error(`Regression tests failed. Summary: ${JSON.stringify(result)}`);
}

if (Number.isFinite(maxMsPerTest) && typeof result.avgMsPerTest === "number" && result.avgMsPerTest > maxMsPerTest) {
  throw new Error(
    `Average test runtime ${result.avgMsPerTest.toFixed(2)}ms exceeded threshold ${maxMsPerTest.toFixed(2)}ms.`
  );
}

console.log(`${path.basename(testFilePath)} passed: ${result.total} tests, avg ${result.avgMsPerTest.toFixed(2)}ms/test${fastMode ? " (FAST mode)" : ""}.`);
if (consoleLines.length > 0) {
  console.log(`Captured ${consoleLines.length} browser console lines.`);
}
