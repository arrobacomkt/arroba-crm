import { expect, test } from '@playwright/test';

async function enableLocalMode(page: Parameters<typeof test>[0]['page']) {
  await page.addInitScript(() => {
    window.localStorage.setItem('arrobaco.forceLocal', 'true');
    window.localStorage.setItem('arrobaco.localSession', 'true');
  });
}

test('services catalog supports create, edit and inactivate in local mode', async ({ page }) => {
  await enableLocalMode(page);
  await page.goto('/app/servicos');

  await expect(page.getByRole('heading', { name: 'Catalogo de Servicos' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo servico' }).click();
  await page.getByLabel('Nome do servico').fill('Servico QA');
  await page.getByLabel('Descricao').fill('Fluxo criado em teste automatizado.');
  await page.getByLabel('Preco padrao (R$)').fill('1234');
  await page.getByLabel('Recorrencia').selectOption('one_off');
  await page.getByRole('button', { name: 'Salvar servico' }).click();

  await expect(page.getByText('Servico QA')).toBeVisible();
  await expect(page.getByText('Fluxo criado em teste automatizado.')).toBeVisible();

  const qaCard = page.locator('article').filter({ hasText: 'Servico QA' }).first();
  await qaCard.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Nome do servico').fill('Servico QA Atualizado');
  await page.getByRole('button', { name: 'Salvar alteracoes' }).click();

  await expect(page.getByText('Servico QA Atualizado')).toBeVisible();

  const updatedCard = page.locator('article').filter({ hasText: 'Servico QA Atualizado' }).first();
  await updatedCard.getByRole('button', { name: 'Inativar' }).click();
  await expect(updatedCard.getByText('Inativo')).toBeVisible();
});

test('documents supports template creation, duplicate and archive toggle in local mode', async ({
  page,
}) => {
  await enableLocalMode(page);
  await page.goto('/app/documentos');

  await expect(page.getByRole('heading', { name: 'Documentos' })).toBeVisible();

  await page.getByRole('button', { name: 'Briefing' }).click();
  await expect(page.getByDisplayValue('Novo briefing')).toBeVisible();

  await page.getByLabel('Titulo').fill('Briefing QA');
  await page.getByLabel('Conteudo').fill('Conteudo de validacao automatizada.');
  await page.getByRole('button', { name: 'Duplicar' }).click();

  await expect(page.getByText('Briefing QA (copia)')).toBeVisible();

  await page.getByRole('button', { name: 'Arquivar documento' }).click();
  await expect(page.getByLabel('Status').last()).toHaveValue('archived');

  await page.getByRole('button', { name: 'Reabrir documento' }).click();
  await expect(page.getByLabel('Status').last()).toHaveValue('draft');
});
