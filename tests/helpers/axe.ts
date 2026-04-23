import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Theme } from "../fixtures/urls";

type Violation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

export async function runAxe(page: Page): Promise<Violation[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    // Third-party embeds render their own UI we can't fix — analyze only the top frame.
    .exclude("iframe[src*='youtube.com']")
    .exclude("iframe[src*='youtube-nocookie.com']")
    .exclude("iframe[src*='jovian.ml']")
    .exclude("iframe[src*='jovian.ai']")
    .analyze();
  return results.violations;
}

export const ALLOWLIST: Array<{ ruleId: string; theme?: Theme; reason: string }> = [];

export function assertNoViolations(
  violations: Violation[],
  allowlist: typeof ALLOWLIST,
  theme: Theme,
) {
  const remaining = violations.filter(
    (v) =>
      !allowlist.some(
        (a) => a.ruleId === v.id && (a.theme === undefined || a.theme === theme),
      ),
  );
  if (remaining.length === 0) return;
  const summary = remaining.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    helpUrl: v.helpUrl,
    node: v.nodes[0]?.html,
  }));
  throw new Error(
    `axe violations on theme="${theme}":\n${JSON.stringify(summary, null, 2)}`,
  );
}
