import type { Page } from "@playwright/test";
import type { Theme } from "../fixtures/urls";

const KEY = "nn-site-theme";

export async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript(
    ({ theme, key }) => {
      try {
        window.localStorage.setItem(key, theme);
      } catch {
        /* ignored */
      }
    },
    { theme, key: KEY }
  );
  await page.reload();
}
