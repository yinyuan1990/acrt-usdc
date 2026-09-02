/**
 * Screenshot every route in both themes at desktop + mobile viewports.
 * Usage: node scripts/shots.mjs [baseUrl]   (default http://localhost:3210)
 * Output: ../docs/screens/<route>-<theme>-<device>.png
 */
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3210";
const OUT = resolve(import.meta.dirname, "../../docs/screens");
mkdirSync(OUT, { recursive: true });

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find(existsSync);
if (!EDGE) throw new Error("No Edge/Chrome binary found");

const ROUTES = [
  ["explore", "/"],
  ["token", "/token/__FIRST__"],
  ["create", "/create"],
  ["creator", "/creator"],
  ["burn", "/burn"],
  ["rank", "/rank"],
];
const THEMES = ["arc", "terminal"];
const DEVICES = {
  desktop: { width: 1440, height: 1000, deviceScaleFactor: 1, isMobile: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-first-run", "--hide-scrollbars"] });
const page = await browser.newPage();

// Resolve first token address from mock module output on the explore page.
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
const firstToken = await page.$eval('a[href^="/token/"]', (a) => a.getAttribute("href").split("/").pop());

for (const [name, path] of ROUTES) {
  const url = path.replace("__FIRST__", firstToken);
  for (const theme of THEMES) {
    for (const [device, vp] of Object.entries(DEVICES)) {
      await page.setViewport(vp);
      await page.goto(`${BASE}${url}?theme=${theme}`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 600));
      const file = `${OUT}/${name}-${theme}-${device}.png`;
      await page.screenshot({ path: file, fullPage: device === "desktop" });
      console.log("saved", file);
    }
  }
}

await browser.close();
