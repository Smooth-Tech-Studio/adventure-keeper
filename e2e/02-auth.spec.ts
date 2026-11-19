/**
 * Scénario 2 — Inscription, connexion, « Rester connecté » et mot de passe
 * oublié, jusqu'au lien reçu par e-mail (lu dans l'émulateur Auth).
 */
import { resetPassword, sentEmails, TEST_PASSWORD, uniqueEmail } from "./support/emulator";
import { expect, signIn, signOut, test } from "./support/fixtures";

test("l'inscription vérifie le formulaire puis crée le compte", async ({ page }) => {
  await page.goto("/signup");
  const submit = page.getByRole("button", { name: "Créer mon compte" });

  await page.getByLabel("Nom affiché").fill("A");
  await page.getByLabel("E-mail").fill("pas-une-adresse");
  await page.getByLabel("Mot de passe", { exact: true }).fill("court");
  await page.getByLabel("Confirmer le mot de passe").fill("autre");
  await submit.click();
  await expect(page.getByText("Au moins 2 caractères")).toBeVisible();
  await expect(page.getByText("Adresse e-mail invalide")).toBeVisible();
  await expect(page.getByText("Au moins 8 caractères", { exact: true })).toBeVisible();

  await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_PASSWORD);
  await submit.click();
  await expect(page.getByText("Les mots de passe ne correspondent pas")).toBeVisible();

  const email = uniqueEmail("inscrit");
  await page.getByLabel("Nom affiché").fill("Aragorn");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Confirmer le mot de passe").fill(TEST_PASSWORD);
  await submit.click();
  await expect(page.getByText("Compte créé, bienvenue !")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mes campagnes" })).toBeVisible();

  await page.getByRole("button", { name: "Menu du compte" }).click();
  await expect(page.getByRole("menu").getByText("Aragorn")).toBeVisible();
  await expect(page.getByRole("menu").getByText(email)).toBeVisible();
  await page.keyboard.press("Escape");

  // Une seconde inscription avec la même adresse est refusée.
  await signOut(page);
  await page.goto("/signup");
  await page.getByLabel("Nom affiché").fill("Imposteur");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(TEST_PASSWORD);
  await submit.click();
  await expect(page.getByText("Un compte existe déjà avec cette adresse e-mail.")).toBeVisible();
});

test("connexion, erreur de mot de passe et déconnexion", async ({ page, account }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();

  await signIn(page, account);
  await expect(page.getByText("Connexion réussie")).toBeVisible();
  await signOut(page);
  await page.goto("/characters");
  await expect(page).toHaveURL(/\/login$/);
});

test("la connexion ramène à la page demandée", async ({ page, account }) => {
  await page.goto("/characters");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/characters$/);
  await expect(page.getByRole("heading", { name: "Mes personnages" })).toBeVisible();
});

test("« Rester connecté » garde la session dans un nouvel onglet", async ({ context, account }) => {
  // Sans la case : la session reste dans l'onglet.
  const first = await context.newPage();
  await signIn(first, account);
  const other = await context.newPage();
  await other.goto("/characters");
  await expect(other).toHaveURL(/\/login$/);
  await other.close();
  await signOut(first);

  // Avec la case : un nouvel onglet est déjà connecté.
  await first.goto("/login");
  await first.getByLabel("E-mail").fill(account.email);
  await first.getByLabel("Mot de passe", { exact: true }).fill(account.password);
  await first.getByText("Rester connecté sur cet appareil").click();
  await first.getByRole("button", { name: "Se connecter" }).click();
  await expect(first.getByRole("button", { name: "Menu du compte" })).toBeVisible();
  const second = await context.newPage();
  await second.goto("/characters");
  await expect(second.getByRole("heading", { name: "Mes personnages" })).toBeVisible();
});

test("mot de passe oublié : le lien reçu permet d'en choisir un nouveau", async ({
  page,
  account,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await expect(page).toHaveURL(/\/mot-de-passe-oublie$/);
  await expect(page.getByRole("button", { name: "Envoyer le lien" })).toBeVisible();
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText(`Si un compte existe pour ${account.email}`)).toBeVisible();

  const [mail] = (await sentEmails(account.email)).filter(
    (code) => code.requestType === "PASSWORD_RESET",
  );
  expect(mail, "un e-mail de réinitialisation a été envoyé").toBeDefined();
  await resetPassword(mail.oobCode, "nouveau-mot-de-passe");

  await signIn(page, { ...account, password: "nouveau-mot-de-passe" });

  // Une adresse inconnue reçoit la même réponse, sans e-mail.
  await signOut(page);
  const stranger = uniqueEmail("inconnu");
  await page.goto("/mot-de-passe-oublie");
  await expect(page.getByRole("button", { name: "Envoyer le lien" })).toBeVisible();
  await page.getByLabel("E-mail").fill(stranger);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText(`Si un compte existe pour ${stranger}`)).toBeVisible();
  expect(await sentEmails(stranger)).toHaveLength(0);
});

test("l'adresse saisie à la connexion suit vers « Mot de passe oublié »", async ({
  page,
  account,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await expect(page.getByLabel("E-mail")).toHaveValue(account.email);
});
