import { expect, test } from '@playwright/test'

test('campaign entry and route choice keep the primary action clear', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Choose your vocation' })).toBeVisible()
  const vocation = page.getByRole('button', { name: /Knight/ })
  await vocation.focus()
  await expect(vocation).toBeFocused()
  await expect(vocation).toHaveCSS('outline-style', 'solid')
  await vocation.click()

  await expect(page.getByRole('heading', { name: 'Choose your next route' })).toBeVisible()
  const travel = page.getByRole('button', { name: /Travel this route/ }).first()
  await expect(travel).toBeVisible()
  await travel.click()

  await expect(page.getByRole('button', { name: /Begin automatic battle/ })).toBeVisible()
})

test('creature codex search and filters remain usable', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Creature codex' }).click()
  await expect(page.getByRole('heading', { name: 'Creature codex' })).toBeVisible()
  const search = page.getByRole('textbox', { name: 'Search creatures' })
  await search.fill('asura')
  const matchingCreatures = page.locator('article')
  await expect(matchingCreatures).toHaveCount(4)
  await expect(matchingCreatures.first()).toContainText(/asura/i)
  await page.getByRole('combobox', { name: 'Filter by role' }).selectOption('mage')
  await expect(matchingCreatures).toHaveCount(3)
})
