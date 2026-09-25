import fs from "node:fs/promises";
import { escapeHtml as h } from "./escape.mjs";

const DATA = new URL("../../resume.json", import.meta.url);
const TEMPLATE = new URL("../templates/resume.tex", import.meta.url);

// Reject unknown fields, so a misspelled field cannot silently omit resume content.
export function validateResume(data) {
  const fail = (location, reason) => { throw new Error(`resume.json: ${location} ${reason}`); };
  const object = (value, keys, location) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(location, "must be an object");
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${location}.${key}`, "is not a supported field");
  };
  const text = (value, location) => {
    if (typeof value !== "string" || !value.trim()) fail(location, "must be nonempty text");
  };
  const list = (value, location, check) => {
    if (!Array.isArray(value) || !value.length) fail(location, "must be a nonempty array");
    value.forEach((item, i) => check(item, `${location}[${i}]`));
  };
  const entry = (item, location) => {
    object(item, ["title", "date", "descriptionLabel", "description", "bullets"], location);
    text(item.title, `${location}.title`);
    text(item.date, `${location}.date`);
    if (item.description !== undefined) text(item.description, `${location}.description`);
    if (item.descriptionLabel !== undefined) {
      text(item.descriptionLabel, `${location}.descriptionLabel`);
      text(item.description, `${location}.description`);
    }
    if (item.bullets !== undefined) list(item.bullets, `${location}.bullets`, text);
  };
  object(data, ["name", "contact", "sections"], "resume");
  text(data.name, "name");
  list(data.contact, "contact", (item, location) => {
    object(item, ["text", "href", "pdfOnly"], location);
    text(item.text, `${location}.text`);
    if (item.pdfOnly !== undefined && typeof item.pdfOnly !== "boolean") fail(`${location}.pdfOnly`, "must be true or false");
    if (item.href !== undefined) {
      text(item.href, `${location}.href`);
      if (!/^(https:\/\/|mailto:|tel:)\S+$/.test(item.href)) fail(`${location}.href`, "must use https, mailto, or tel");
    }
  });
  list(data.sections, "sections", (section, location) => {
    object(section, ["title", "kind", "items"], location);
    text(section.title, `${location}.title`);
    if (!["education", "skills", "entries"].includes(section.kind)) fail(`${location}.kind`, "must be education, skills, or entries");
    list(section.items, `${location}.items`, (item, itemLocation) => {
      if (section.kind === "entries") return entry(item, itemLocation);
      if (section.kind === "skills") {
        object(item, ["label", "text"], itemLocation);
        text(item.label, `${itemLocation}.label`);
        text(item.text, `${itemLocation}.text`);
      } else {
        object(item, ["title", "entries"], itemLocation);
        text(item.title, `${itemLocation}.title`);
        list(item.entries, `${itemLocation}.entries`, entry);
      }
    });
  });
  return data;
}

export async function loadResume() {
  return validateResume(JSON.parse(await fs.readFile(DATA, "utf8")));
}

function htmlEntry(entry, subentry = false) {
  const tag = subentry ? "div" : "article";
  return `<${tag} class="${subentry ? "resume-subentry" : "resume-entry"}">
  <div class="resume-row"><span class="resume-row-title">${h(entry.title)}</span><span class="resume-row-date">${h(entry.date)}</span></div>
  ${entry.description ? `<p class="resume-detail">${entry.descriptionLabel ? `<em>${h(entry.descriptionLabel)}</em> ` : ""}${h(entry.description)}</p>` : ""}
  ${entry.bullets ? `<ul class="resume-bullets">${entry.bullets.map((bullet) => `<li>${h(bullet)}</li>`).join("\n")}</ul>` : ""}
  </${tag}>`;
}

export function renderResumeHtml(data) {
  validateResume(data);
  return `<article class="resume-page">
<header class="resume-header">
  <h1 class="resume-name">${h(data.name)}</h1>
  <p class="resume-contact">${data.contact.filter((item) => !item.pdfOnly).map((item) => item.href ? `<a href="${h(item.href)}">${h(item.text)}</a>` : h(item.text)).join('<span class="resume-sep" aria-hidden="true">•</span>')}</p>
  <div class="resume-actions no-print"><a class="btn btn-primary" href="/Resume.pdf" target="_blank" rel="noopener">Download PDF</a></div>
</header>
${data.sections.map((section) => {
    let body;
    if (section.kind === "skills") {
      body = `<ul class="resume-skills">${section.items.map((item) => `<li><strong>${h(item.label)}</strong> ${h(item.text)}</li>`).join("\n")}</ul>`;
    } else if (section.kind === "education") {
      body = section.items.map((school) => `<div class="resume-school"><p class="resume-school-name">${h(school.title)}</p>${school.entries.map((item) => htmlEntry(item, true)).join("\n")}</div>`).join("\n");
    } else body = section.items.map((item) => htmlEntry(item)).join("\n");
    return `<section class="resume-section"><h2>${h(section.title)}</h2>${body}</section>`;
  }).join("\n")}
</article>`;
}

const TEX_ESCAPES = {
  "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "$": "\\$", "&": "\\&",
  "#": "\\#", "%": "\\%", "_": "\\_", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};
export const escapeLatex = (value) => value.replace(/[\\{}$&#%_~^]/g, (c) => TEX_ESCAPES[c]);
const t = escapeLatex;
const texList = (items) => `\\begin{achievements}\n${items.map((item) => `\\item ${item}`).join("\n")}\n\\end{achievements}`;

function texEntry(entry) {
  const description = entry.description ? `${entry.descriptionLabel ? `\\emph{${t(entry.descriptionLabel)}} ` : ""}${t(entry.description)}` : "";
  return `\\schoolwithcourses{${t(entry.title)}}{${t(entry.date)}}{${description}}\n${entry.bullets ? `\\vspace{-2mm}\n${texList(entry.bullets.map(t))}` : ""}`;
}

export async function renderResumeLatex(data) {
  validateResume(data);
  const body = [
    `\\contact{${t(data.name)}}{${data.contact.map((item) => t(item.text)).join(" \\textbullet{} ")}}`,
    "\\vspace{-2mm}",
    ...data.sections.map((section) => {
      let body;
      if (section.kind === "skills") body = texList(section.items.map((item) => `\\textbf{${t(item.label)}} ${t(item.text)}`));
      else if (section.kind === "education") body = section.items.map((school) => `\\schoolwithcourses{${t(school.title)}}{}{}\n${texList(school.entries.map(texEntry))}`).join("\n");
      else body = section.items.map(texEntry).join("\n");
      return `\\header{${t(section.title)}}\n${body}`;
    }),
  ].join("\n\n");
  const template = await fs.readFile(TEMPLATE, "utf8");
  if (template.split("%%RESUME_BODY%%").length !== 2) throw new Error("resume.tex must contain exactly one %%RESUME_BODY%% marker");
  return template.replace("%%RESUME_BODY%%", () => body);
}
