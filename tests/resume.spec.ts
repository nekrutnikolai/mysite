import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

// Only reading-order text is compared: line wraps, ligatures, and list markers
// belong to the layout. Every actual word, date, and punctuation mark must match.
const normalize = (text: string) => text.normalize("NFKC").replace(/[\s\u00ad•]/gu, "");
function visibleValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(visibleValues);
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return ["name", "contact", "title", "date", "descriptionLabel", "description", "label", "text", "bullets", "entries", "items", "sections"]
      .filter((key) => key in item).flatMap((key) => visibleValues(item[key]));
  }
  return typeof value === "string" ? [value] : [];
}

test("webpage and PDF match shared content, with PDF-only contacts respected", async ({ page, request }) => {
  const data = JSON.parse(await fs.readFile(new URL("../resume.json", import.meta.url), "utf8"));
  const expected = normalize(visibleValues(data).join(" "));
  const htmlExpected = normalize(visibleValues({ ...data, contact: data.contact.filter((item: { pdfOnly?: boolean }) => !item.pdfOnly) }).join(" "));
  await page.goto("/resume/");
  const resume = page.locator(".resume-page");
  const htmlText = await resume.locator(".resume-name, .resume-contact, .resume-section").allInnerTexts();
  expect(normalize(htmlText.join(" "))).toBe(htmlExpected);
  for (const contact of data.contact.filter((item: { pdfOnly?: boolean }) => item.pdfOnly)) {
    expect(await resume.innerHTML()).not.toContain(contact.text);
    if (contact.href) expect(await resume.innerHTML()).not.toContain(contact.href);
  }

  const link = resume.getByRole("link", { name: "Download PDF" });
  const response = await request.get((await link.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("pdf");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "mysite-resume-test-"));
  try {
    const pdf = path.join(temporary, "Resume.pdf");
    await fs.writeFile(pdf, await response.body());
    const pdfText = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
    expect(normalize(pdfText)).toBe(expected);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
