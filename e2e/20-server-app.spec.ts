/**
 * Scénario 20 — Adventure Keeper Serveur, l'app de bureau qui fait tourner le
 * serveur temps réel sur l'ordinateur du MJ : la page de téléchargement, et la
 * boîte de lancement qui trouve l'app sur cet ordinateur. L'app est simulée :
 * `127.0.0.1:8787/health` répond comme elle, avec son adresse publique.
 */
import { expect, test } from "./support/fixtures";
import { prepareTable } from "./support/table";

const PUBLIC_URL = "https://brave-otter-lantern-quest.trycloudflare.com";

test("la page de téléchargement, sans compte", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Serveur de session" }).click();
  await expect(page).toHaveURL(/\/serveur$/);
  await expect(page.getByRole("heading", { name: "Adventure Keeper Serveur" })).toBeVisible();
  // Chromium sous Linux : l'AppImage d'abord, les autres systèmes à côté.
  await expect(page.getByRole("link", { name: "Linux (AppImage)" })).toHaveAttribute(
    "href",
    /releases\/latest\/download\/Adventure-Keeper-Serveur-linux-x64\.AppImage$/,
  );
  await expect(page.getByRole("link", { name: "Windows" })).toBeVisible();
  await expect(page.getByRole("link", { name: "macOS (Apple Silicon)" })).toBeVisible();
});

test("la boîte de lancement trouve l'app sur cet ordinateur", async ({
  signedInPage: gmPage,
  account,
}) => {
  const table = await prepareTable(account);
  let running = false;
  await gmPage.route("http://127.0.0.1:8787/health", (route) =>
    running
      ? route.fulfill({
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            ok: true,
            service: "adventure-keeper-realtime",
            version: "0.1.0",
            publicUrl: PUBLIC_URL,
          }),
        })
      : route.abort("connectionrefused"),
  );

  await gmPage.goto(table.adventurePath);
  await gmPage.getByRole("button", { name: "Démarrer avec un serveur temps réel…" }).click();
  const dialog = gmPage.getByRole("dialog", { name: "Démarrer avec un serveur temps réel" });

  // L'app n'est pas lancée : on le dit, avec le lien pour la télécharger.
  await dialog.getByRole("button", { name: "Chercher" }).click();
  await expect(dialog.getByText("Pas de serveur trouvé")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Adventure Keeper Serveur" })).toHaveAttribute(
    "href",
    "/serveur",
  );

  // Lancée : son adresse publique remplit le champ, prête à démarrer.
  running = true;
  await dialog.getByRole("button", { name: "Réessayer" }).click();
  await expect(dialog.getByLabel("Adresse du serveur")).toHaveValue(PUBLIC_URL);
  await expect(dialog.getByText("Adresse d'Adventure Keeper Serveur")).toBeVisible();
  await expect(dialog.getByText("Le serveur répond.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Démarrer la session" })).toBeEnabled();
});
