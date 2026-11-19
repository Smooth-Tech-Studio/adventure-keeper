/**
 * Scénario 1 — Visiteur et invité : la page d'accueil, les pages publiques, et
 * la création 5E sans compte, enregistrée ensuite dans un compte tout neuf.
 */
import { charactersOf, adminAuth, uniqueEmail, TEST_PASSWORD } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { Wizard } from "./support/wizard";

test("la page d'accueil propose de s'inscrire, se connecter ou essayer", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Gardez la mémoire de vos aventures" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Créer un compte" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Se connecter" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Essayer la création de personnage" }).click();
  await expect(
    page.getByRole("heading", { name: "Quelle classe voulez-vous jouer ?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Créer un compte pour enregistrer" }),
  ).toBeVisible();
  await expect(page.getByText("Sans compte, la création reste sur cet appareil")).toBeVisible();
});

test("les pages publiques et protégées", async ({ page }) => {
  await page.goto("/credits");
  await expect(page.getByRole("heading", { name: "Crédits et licences" })).toBeVisible();

  await page.goto("/une-page-qui-n-existe-pas");
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

  // Une page réservée renvoie vers la connexion.
  for (const path of ["/campaigns", "/characters", "/packs", "/profil"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("la fiche standard demande un compte", async ({ page }) => {
  await page.goto("/characters/new");
  await page.getByRole("radio", { name: /Standard/ }).click();
  await expect(
    page.getByText("La fiche libre s'enregistre directement dans votre compte"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Se connecter" }).last().click();
  await expect(page).toHaveURL(/\/login$/);
});

test("une création interrompue se reprend sur l'appareil", async ({ page }) => {
  const wizard = new Wizard(page);
  await wizard.open();
  await wizard.chooseCard("Guerrier");
  await page.getByRole("textbox", { name: "Nom du personnage" }).fill("Brunhild");
  await wizard.next();
  // Laisse passer la sauvegarde automatique (différée).
  await page.waitForTimeout(1_000);

  await page.reload();
  await expect(page.getByText("Une création 5E est en cours sur cet appareil")).toBeVisible();
  await expect(page.getByText(/Brunhild · Guerrier niv\. 1/)).toBeVisible();
  await page.getByRole("button", { name: "Reprendre" }).click();
  await expect(page.getByRole("complementary").getByText("Brunhild").first()).toBeVisible();

  // « Recommencer » repart d'une page blanche.
  await page.reload();
  await page.getByRole("button", { name: "Recommencer" }).click();
  await expect(page.getByText("Une création 5E est en cours sur cet appareil")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Quelle classe voulez-vous jouer ?" }),
  ).toBeVisible();
  await expect(page.getByRole("complementary").getByText("Brunhild")).toHaveCount(0);
});

test("un invité crée un personnage puis l'enregistre en s'inscrivant", async ({ page }) => {
  const wizard = new Wizard(page);
  await wizard.open();
  await wizard.createFighter("Brunhild");

  // Valider sans compte mène à l'inscription…
  await wizard.validate();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByText("votre personnage vous attend ici")).toBeVisible();

  const email = uniqueEmail("invite");
  await page.getByLabel("Nom affiché").fill("Invitée");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  // … qui ramène à la création, là où elle en était.
  await expect(page.getByText("Votre création est reprise")).toBeVisible();
  await expect(page).toHaveURL(/\/characters\/new(\?(?!.*resume).*)?$/);
  await expect(page.getByRole("complementary").getByText("Brunhild").first()).toBeVisible();

  // Elle reprend à l'étape Équipement : on va jusqu'à la relecture et on valide.
  await wizard.expectQuestion("Ce que vous emportez déjà");
  await wizard.next();
  await wizard.next();
  await wizard.validate();
  await expect(page.getByText("Personnage créé.")).toBeVisible();
  await expect(page.getByText("Nain · Guerrier · niv. 1")).toBeVisible();

  const { uid } = await adminAuth.getUserByEmail(email);
  const characters = await charactersOf(uid);
  expect(characters).toHaveLength(1);
  expect(characters[0]).toMatchObject({ name: "Brunhild", classId: "fighter" });
});
