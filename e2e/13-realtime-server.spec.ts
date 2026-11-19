/**
 * Scénario 13 bis — Une session jouée par un serveur temps réel (self-host) :
 * le MJ la lance avec l'adresse du serveur ; jetons, PV et combat passent par
 * la salle, pas par Firestore, et y reviennent à la fin de la session. La
 * brume aussi : les joueurs la voient se lever pendant que le MJ peint.
 */
import type { Page } from "@playwright/test";

import { adminDb } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { REALTIME_PORT } from "./support/ports";
import { gmTab, joinSession, prepareTable, showLocation } from "./support/table";

/** The fog's opacity at the middle of the map, as this page draws it (0–255). */
const fogAtCentre = (page: Page) =>
  page.locator("canvas[data-fog]").evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")!;
    return ctx.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data[3]!;
  });

test("une session par le serveur temps réel", async ({ signedInPage: gmPage, account, openAs }) => {
  const table = await prepareTable(account);

  // Le MJ teste l'adresse, puis lance la session avec le serveur.
  await gmPage.goto(table.adventurePath);
  await gmPage.getByRole("button", { name: "Démarrer avec un serveur temps réel…" }).click();
  const dialog = gmPage.getByRole("dialog", { name: "Démarrer avec un serveur temps réel" });
  await dialog.getByLabel("Adresse du serveur").fill("http://nulle-part.invalid");
  await dialog.getByRole("button", { name: "Tester" }).click();
  await expect(dialog.getByText("Pas de serveur Adventure Keeper")).toBeVisible();
  await dialog.getByLabel("Adresse du serveur").fill(`http://localhost:${REALTIME_PORT}`);
  await dialog.getByRole("button", { name: "Tester" }).click();
  await expect(dialog.getByText("Le serveur répond.")).toBeVisible();
  await dialog.getByRole("button", { name: "Démarrer la session" }).click();
  await expect(gmPage).toHaveURL(/\/session\/[^/]+$/);
  const sessionId = gmPage.url().split("/").pop()!;
  const sessionRef = adminDb.doc(
    `campaigns/${table.campaignId}/adventures/${table.adventureId}/liveSessions/${sessionId}`,
  );
  expect((await sessionRef.get()).data()?.realtime?.url).toBe(`http://localhost:${REALTIME_PORT}`);

  await showLocation(gmPage, "Le portail");
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);

  // La présence vient de la salle : Firestore ne retient que la venue de Bob.
  await gmPage.getByRole("button", { name: "En direct" }).click();
  await expect(gmPage.getByText("2 connecté(s)")).toBeVisible();
  await gmPage.keyboard.press("Escape");
  const presence = (await sessionRef.get()).data()!;
  expect(presence.attendeeUids).toContain(table.bob.uid);
  expect(presence.connectedUids).not.toContain(table.bob.uid);

  // Les PV de Thorin passent par la salle : le MJ les voit, Firestore attend.
  const thorinRef = (
    await adminDb
      .collection(`campaigns/${table.campaignId}/adventures/${table.adventureId}/participants`)
      .where("characterName", "==", "Thorin")
      .get()
  ).docs[0]!.ref;
  const hpBefore = (await thorinRef.get()).data()?.currentHitPoints;
  await bobPage.getByRole("button", { name: "Retirer 1 PV", exact: true }).click();
  await bobPage.getByRole("button", { name: "Retirer 1 PV", exact: true }).click();
  await expect(gmPage.getByRole("button", { name: /Thorin 11\/13/ })).toBeVisible();
  expect((await thorinRef.get()).data()?.currentHitPoints).toBe(hpBefore);

  // Un combat : Thorin contre un gobelin.
  await gmTab(gmPage, "Combat");
  await gmPage.getByRole("button", { name: "Lancer le combat" }).click();
  const setup = gmPage.getByRole("dialog", { name: "Créer un combat" });
  const miraRow = setup.getByRole("spinbutton", { name: "Initiative de Mira" }).locator("..");
  await miraRow.getByRole("checkbox").uncheck();
  await setup.getByRole("spinbutton", { name: "Initiative de Thorin" }).fill("20");
  await setup.getByRole("button", { name: "Ajouter un ennemi" }).click();
  await gmPage.getByRole("menuitem", { name: /^Gobelin/ }).click();
  await setup.getByRole("spinbutton", { name: "Initiative", exact: true }).fill("5");
  await setup.getByRole("button", { name: "Lancer le combat" }).click();
  await expect(setup).toBeHidden();

  // Le joueur suit le combat ; les PV changent chez lui.
  await expect(bobPage.getByText(/Round 1/).first()).toBeVisible();
  const goblin = gmPage.locator("#gm-combat li").filter({ hasText: "Gobelin 1" });
  await goblin.getByRole("button", { name: "Retirer 1 PV" }).click();
  await expect(goblin.getByRole("button", { name: /^6 sur 7 PV/ })).toBeVisible();
  await gmPage.locator("#gm-combat-next").click();
  await expect(goblin).toHaveAttribute("aria-current", "true");

  // Rien dans Firestore pendant la session : tout est dans la salle.
  const combatants = sessionRef.collection("combatants");
  expect((await combatants.get()).size).toBe(0);
  expect((await sessionRef.get()).data()?.combat).toBeUndefined();

  // La brume d'un lieu caché : le joueur la voit se lever pendant que le MJ
  // peint, sans attendre que la gomme soit rangée.
  await gmTab(gmPage, "Scène");
  await showLocation(gmPage, "La crypte");
  await expect(bobPage.locator("canvas[data-fog]")).toBeVisible();
  await expect.poll(() => fogAtCentre(bobPage)).toBeGreaterThan(200);
  await gmPage.getByRole("button", { name: "Gomme (révéler à la main)" }).click();
  const map = gmPage.getByRole("img", { name: "Carte du lieu" });
  const box = (await map.boundingBox())!;
  await gmPage.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await gmPage.mouse.down();
  await gmPage.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 10 });
  await expect.poll(() => fogAtCentre(bobPage)).toBeLessThan(50);
  await gmPage.mouse.up();
  const reveals = sessionRef.collection("mapReveals");
  const mask = async () =>
    (await reveals.get()).docs.find((d) => d.data().hidden)?.data().mask as string | undefined;
  expect(await mask()).toBeUndefined();

  // Fin de session : la salle se recopie dans Firestore.
  await gmPage.getByRole("button", { name: "En direct" }).click();
  await gmPage.getByRole("menuitem", { name: "Terminer la session" }).click();
  const confirm = gmPage.getByRole("dialog", { name: "Terminer la session ?" });
  await confirm.getByRole("button", { name: "Terminer la session" }).click();
  await expect.poll(async () => (await combatants.get()).size).toBe(2);
  await expect.poll(async () => (await sessionRef.get()).data()?.status).toBe("ended");
  expect((await sessionRef.get()).data()?.combat).toMatchObject({ round: 1, turnIndex: 1 });
  // Brume comprise, et les PV de Thorin.
  await expect.poll(mask).toBeTruthy();
  await expect.poll(async () => (await thorinRef.get()).data()?.currentHitPoints).toBe(11);
});
