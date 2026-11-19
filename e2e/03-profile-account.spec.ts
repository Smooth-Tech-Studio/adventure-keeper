/**
 * Scénario 3 — Profil et compte : pseudo, présentation et avatar, thème,
 * changement de mot de passe et d'adresse (lien reçu par e-mail), suppression
 * du compte, refusée tant qu'on dirige une campagne.
 */
import { createCampaign } from "./support/data";
import { adminAuth, adminDb, sentEmails, uniqueEmail } from "./support/emulator";
import { expect, signIn, signOut, test } from "./support/fixtures";

test("le profil : pseudo, présentation, avatar", async ({ signedInPage: page, account }) => {
  await page.getByRole("button", { name: "Menu du compte" }).click();
  await page.getByRole("menuitem", { name: "Mon profil" }).click();
  await expect(page).toHaveURL(/\/profil$/);

  const save = page.getByRole("button", { name: "Enregistrer", exact: true });
  await expect(save).toBeDisabled();
  await page.getByLabel("Pseudo").fill("Gandalf le Gris");
  await page.getByLabel("Présentation").fill("MJ le jeudi soir, joueur le samedi.");
  await page.getByLabel("Avatar (lien vers une image)").fill("https://images.e2e.test/avatar.svg");
  await save.click();
  await expect(page.getByText("Profil enregistré.")).toBeVisible();

  // Le nouveau pseudo s'affiche aussitôt dans le menu du compte.
  await page.getByRole("button", { name: "Menu du compte" }).click();
  await expect(page.getByRole("menu").getByText("Gandalf le Gris")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(page.getByLabel("Présentation")).toHaveValue("MJ le jeudi soir, joueur le samedi.");
  const profile = (await adminDb.doc(`users/${account.uid}`).get()).data();
  expect(profile).toMatchObject({ displayName: "Gandalf le Gris" });
});

test("le thème clair ou sombre", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Paramètres" }).click();
  await page.getByRole("radio", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Paramètres" }).click();
  await page.getByRole("radio", { name: "Clair" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("changer de mot de passe", async ({ signedInPage: page, account }) => {
  await page.goto("/profil");
  const section = page.locator("form").filter({ hasText: "Nouveau mot de passe" });
  const submit = section.getByRole("button");

  await section.getByLabel("Mot de passe actuel").fill("mauvais-mot-de-passe");
  await section.getByLabel("Nouveau mot de passe").fill("nouveau-secret");
  await section.getByLabel("Confirmez-le").fill("autre-secret");
  await expect(section.getByText("Les deux mots de passe diffèrent.")).toBeVisible();

  await section.getByLabel("Confirmez-le").fill("nouveau-secret");
  await submit.click();
  await expect(page.getByText("Mot de passe actuel incorrect.")).toBeVisible();

  await section.getByLabel("Mot de passe actuel").fill(account.password);
  await submit.click();
  await expect(page.getByText("Mot de passe changé.")).toBeVisible();

  await signOut(page);
  await signIn(page, { ...account, password: "nouveau-secret" });
});

test("changer d'adresse e-mail, confirmée par le lien reçu", async ({
  signedInPage: page,
  account,
}) => {
  const newEmail = uniqueEmail("nouvelle");
  await page.goto("/profil");
  const section = page.locator("form").filter({ hasText: "Nouvelle adresse" });
  await section.getByLabel("Nouvelle adresse").fill(newEmail);
  await section.getByLabel("Mot de passe actuel").fill(account.password);
  await section.getByRole("button", { name: "Changer d'adresse" }).click();
  await expect(section.getByText(`Lien envoyé à ${newEmail}`)).toBeVisible();

  // L'ancienne adresse reste valable tant que le lien n'est pas suivi.
  const [mail] = (await sentEmails(account.email)).filter(
    (code) => code.requestType === "VERIFY_AND_CHANGE_EMAIL",
  );
  expect(mail, "un lien de confirmation a été envoyé").toBeDefined();
  expect((await adminAuth.getUser(account.uid)).email).toBe(account.email);
  await fetch(mail.oobLink);
  expect((await adminAuth.getUser(account.uid)).email).toBe(newEmail);

  // À la connexion suivante, le profil suit (c'est lui que les invitations cherchent).
  await signOut(page);
  await signIn(page, { ...account, email: newEmail });
  await expect
    .poll(async () => (await adminDb.doc(`users/${account.uid}`).get()).data()?.email)
    .toBe(newEmail);
});

test("supprimer son compte, une fois ses campagnes supprimées", async ({
  signedInPage: page,
  account,
}) => {
  const campaignId = await createCampaign(account, "La Crypte");
  await page.goto("/profil");
  await expect(page.getByText("Vous êtes Maître du jeu de cette campagne")).toBeVisible();
  await expect(page.getByRole("link", { name: "La Crypte" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Supprimer définitivement" })).toHaveCount(0);

  await adminDb.recursiveDelete(adminDb.doc(`campaigns/${campaignId}`));
  await page.reload();
  const confirm = page.getByLabel("Tapez SUPPRIMER pour confirmer");
  const remove = page.getByRole("button", { name: "Supprimer définitivement" });
  await page.locator("#delete-password").fill(account.password);
  await confirm.fill("supprimer");
  await expect(remove).toBeDisabled();
  await confirm.fill("SUPPRIMER");
  await remove.click();
  await expect(page.getByText("Votre compte est supprimé.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu du compte" })).toHaveCount(0);

  await expect(adminAuth.getUser(account.uid)).rejects.toThrow();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
});
