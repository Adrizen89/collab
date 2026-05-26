import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@collab.local';
const ADMIN_PASSWORD = 'Admin1234!';

test('parcours nominal : connexion → création → édition temps réel', async ({ page }) => {
  // 1. Connexion
  await page.goto('/');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Mot de passe').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page.getByRole('heading', { name: 'Mes documents' })).toBeVisible();

  // 2. Création d'un document texte
  const docName = `E2E ${Date.now()}`;
  await page.getByRole('button', { name: /Nouveau \(racine\)/ }).click();
  await page.getByPlaceholder('Nom (à la racine)').fill(docName);
  await page.getByRole('button', { name: 'Créer', exact: true }).click();

  const docItem = page.getByText(docName, { exact: true });
  await expect(docItem).toBeVisible();

  // 3. Ouverture de l'éditeur
  await docItem.click();
  await expect(page.locator('.cm-editor')).toBeVisible();

  // 4. La synchro temps réel s'établit
  await expect(page.locator('.status-pill')).toContainText(/Synchronis|Connect/i, {
    timeout: 15_000,
  });

  // 5. Édition : le texte saisi apparaît dans l'éditeur
  await page.locator('.cm-content').click();
  await page.keyboard.type('Bonjour depuis Playwright');
  await expect(page.locator('.cm-content')).toContainText('Bonjour depuis Playwright');

  // 6. Le panneau d'invitation est présent
  await expect(page.getByText('Personnes invitées')).toBeVisible();
});

test('un visiteur non connecté est redirigé vers la connexion', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
});
