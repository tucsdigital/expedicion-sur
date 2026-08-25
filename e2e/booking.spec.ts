import { test, expect } from '@playwright/test';

test('flujo sin fechas: muestra Reservar y arma href con pax', async ({ page }) => {
  await page.goto('/__e2e__/booking');

  const reserveLink = page.getByRole('link', { name: /Reservar/i }).first();
  await expect(reserveLink).toBeVisible();
  await expect(reserveLink).toHaveAttribute(/href/, /date=sin-fecha/);
  await expect(reserveLink).toHaveAttribute(/href/, /people=1/);

  const incChildren = page.getByRole('button', { name: 'Sumar Niños' });
  await incChildren.click();
  await incChildren.click();

  await expect(reserveLink).toHaveAttribute(/href/, /people=3/);
  await expect(reserveLink).toHaveAttribute(/href/, /pax=%7B/);

  for (let i = 0; i < 10; i += 1) {
    await incChildren.click();
  }

  await expect(page.getByText(/Total:/)).toContainText('6');
  await expect(reserveLink).toHaveAttribute(/href/, /people=6/);
});

test('flujo con fechas: el calendario filtra días por cupo según personas', async ({ page }) => {
  await page.goto('/__e2e__/booking?mode=dates');

  await page.getByRole('button', { name: /Elegir fecha/i }).click();
  await expect(page.getByText('Elegí tu fecha')).toBeVisible();

  const selectable = page.locator('button[aria-label^="Seleccionar "]');
  await expect(selectable).toHaveCount(2);

  await page.getByRole('button', { name: /Cambiar personas/i }).click();

  const incChildren = page.getByRole('button', { name: 'Sumar Niños' });
  for (let i = 0; i < 5; i += 1) {
    await incChildren.click();
  }

  await page.getByRole('button', { name: /Elegir fecha/i }).click();
  await expect(selectable).toHaveCount(1);
});

test('seguridad: bloquea origen no autorizado en MP preference', async ({ request }) => {
  const response = await request.post('/api/mercadopago/preference', {
    headers: {
      origin: 'https://evil.example',
    },
    data: {},
  });

  expect(response.status()).toBe(403);
});

