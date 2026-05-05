// Render the /resume/ page to a printable PDF using a headless browser. The
// page already has @media print styles tuned for Letter; we just point the
// browser at it, swap to print media emulation, and dump the result. Caller
// must run a static server pointing at dist/ and pass its origin in.

import { withPage } from "./browser.mjs";

export async function generateResumePdf({ outPath, devServerUrl }) {
  await withPage(async (page) => {
    await page.goto(`${devServerUrl}/resume/`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: outPath,
      format: "Letter",
      printBackground: false,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" }
    });
  });
}
