import test from "node:test";
import assert from "node:assert/strict";
import { loadResume, validateResume, renderResumeHtml, renderResumeLatex } from "../lib/resume.mjs";

test("rejects misspelled fields and invalid contact links", async () => {
  const data = await loadResume();
  data.sections[2].items[0].bullet = ["This must not disappear silently"];
  assert.throws(() => validateResume(data), /bullet is not a supported field/);
  delete data.sections[2].items[0].bullet;
  data.contact[0].href = "javascript:alert(1)";
  assert.throws(() => validateResume(data), /must use https, mailto, or tel/);
});

test("plain text special characters are escaped for both output formats", async () => {
  const data = await loadResume();
  data.name = String.raw`A&B <script> 50% $5 #1 {x}_y ~ ^ \input{other}`;
  const html = renderResumeHtml(data);
  const latex = await renderResumeLatex(data);
  assert.ok(html.includes("A&amp;B &lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(latex.includes(String.raw`A\&B <script> 50\% \$5 \#1 \{x\}\_y \textasciitilde{} \textasciicircum{} \textbackslash{}input\{other\}`));
});

test("PDF-only contact information is absent from the webpage", async () => {
  const data = await loadResume();
  data.contact.push({ text: "555-0199", href: "tel:5550199", pdfOnly: true });
  const html = renderResumeHtml(data);
  assert.ok(!html.includes("555-0199"));
  assert.ok(!html.includes("tel:5550199"));
  assert.ok((await renderResumeLatex(data)).includes("555-0199"));
});

test("added sections, bullets, and contacts appear in both renderers", async () => {
  const data = await loadResume();
  data.contact.push({ text: "555-0100", href: "tel:5550100" });
  data.sections.push({ title: "New section", kind: "entries", items: [{
    title: "New position", date: "2026", descriptionLabel: "Summary:",
    description: "New description", bullets: ["First new bullet", "Second new bullet"],
  }] });
  const html = renderResumeHtml(data);
  const latex = await renderResumeLatex(data);
  for (const value of ["555-0100", "New section", "New position", "2026", "Summary:", "New description", "First new bullet", "Second new bullet"]) {
    assert.ok(html.includes(value), `HTML missing ${value}`);
    assert.ok(latex.includes(value), `LaTeX missing ${value}`);
  }
});
