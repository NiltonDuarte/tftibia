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
  await expect(battlefield).toHaveCSS('background-image', /battle\/(cobra-bastion|asura-palace|falcon-bastion|mirrored-crypt|fractured-throne)-v[0-9]+\.png/)
  const playableGrid = battlefield.locator('[class*="sqmBoard"]')
  const playableBounds = await playableGrid.boundingBox()
  const scenarioBounds = await battlefield.boundingBox()
  if (!playableBounds || !scenarioBounds) throw new Error('The battlefield scenario and playable grid must both have visible bounds.')
  const withinRenderingTolerance = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(4)
  withinRenderingTolerance(playableBounds.x - scenarioBounds.x, scenarioBounds.width * 0.15)
  withinRenderingTolerance(playableBounds.y - scenarioBounds.y, scenarioBounds.height * 0.15)
  withinRenderingTolerance(playableBounds.width, scenarioBounds.width * 0.7)
  withinRenderingTolerance(playableBounds.height, scenarioBounds.height * 0.7)
  withinRenderingTolerance(playableBounds.width, playableBounds.height)
  const units = await playableGrid.locator('[class*="arenaUnit"]').all()
  expect(units.length).toBeGreaterThan(0)
  for (const unit of units) {
    const unitBounds = await unit.boundingBox()
    if (!unitBounds) throw new Error('Every combatant must have visible bounds inside the playable grid.')
    expect(unitBounds.x).toBeGreaterThanOrEqual(playableBounds.x)
    expect(unitBounds.y).toBeGreaterThanOrEqual(playableBounds.y)
    expect(unitBounds.x + unitBounds.width).toBeLessThanOrEqual(playableBounds.x + playableBounds.width + 1)
    expect(unitBounds.y + unitBounds.height).toBeLessThanOrEqual(playableBounds.y + playableBounds.height + 1)
  }
  const sqmTile = page.locator('[class*="sqmTile"]').first()
  await expect(sqmTile).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(sqmTile).toHaveCSS('border-top-width', '0px')
  const gridToggle = page.getByRole('button', { name: 'Show playable grid' })
  await expect(gridToggle).toHaveAttribute('aria-pressed', 'false')
  await gridToggle.click()
  await expect(page.getByRole('button', { name: 'Hide playable grid' })).toHaveAttribute('aria-pressed', 'true')
  await expect(sqmTile).toHaveCSS('border-top-width', '1px')
  await page.getByRole('button', { name: 'Hide playable grid' }).click()
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
