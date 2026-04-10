import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const testFilePath = path.resolve("test", "run_tests.html");
const testUrl = pathToFileURL(testFilePath).toString();
const maxMsPerTest = Number.parseFloat(process.env.ALPHAJONG_MAX_MS_PER_TEST || "250");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleLines = [];
const pageErrors = [];

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

await page.waitForFunction(() => window.__ALPHAJONG_TEST_DONE === true, {
  timeout: 240000
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

console.log(`Headless tests passed: ${result.total} tests, avg ${result.avgMsPerTest.toFixed(2)}ms/test.`);
if (consoleLines.length > 0) {
  console.log(`Captured ${consoleLines.length} browser console lines.`);
}
