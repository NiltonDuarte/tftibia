import { expect, test } from '@playwright/test'
import { GameStateSchema } from '../src/game/stateSchema'

test('world map branches lead to playable full-room battles', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Choose your vocation' })).toBeVisible()
  const vocation = page.getByRole('button', { name: /Knight/ })
  await vocation.focus()
  await expect(vocation).toBeFocused()
  await expect(vocation).toHaveCSS('outline-style', 'solid')
  await vocation.click()

  await expect(page.getByRole('heading', { name: 'Choose your next route' })).toBeVisible()
  const savedValue = await page.evaluate(() => window.localStorage.getItem('tibia-tactics-save'))
  if (!savedValue) throw new Error('The campaign save was not written after vocation selection.')
  const validState = GameStateSchema.parse(JSON.parse(savedValue) as unknown)
  const staleRouteState = {
    ...validState,
    mapNodeId: 'retired-location',
    routeEdges: {
      ...validState.routeEdges,
      crossroads: ['missing-route'],
      'retired-location': ['missing-route'],
    },
  }
  await page.evaluate((serialized) => window.localStorage.setItem('tibia-tactics-save', serialized), JSON.stringify(staleRouteState))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Choose your next route' })).toBeVisible()

  const mapRoutes = page.getByRole('button', { name: /Travel to / })
  await expect(mapRoutes).toHaveCount(3)
  await mapRoutes.first().click()

  await page.getByRole('button', { name: /Recruit/ }).first().click()

  const beginBattle = page.getByRole('button', { name: /Begin automatic battle/ })
  await expect(beginBattle).toBeVisible()
  await expect(beginBattle).toBeEnabled()
  await beginBattle.click()

  const battlefield = page.locator('[class*="arenaGrid"][aria-label="Live tactical battlefield"]')
  await expect(battlefield).toBeVisible()
  await expect(battlefield).toHaveCSS('background-image', /battle\/(cobra-bastion|asura-palace|falcon-bastion|mirrored-crypt|fractured-throne)\.png/)
  const sqmTile = page.locator('[class*="sqmTile"]').first()
  await expect(sqmTile).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(sqmTile).toHaveCSS('border-top-width', '0px')
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
