import { describe, expect, it } from 'vitest'
import { iconRegistry } from '@/components/ui/icons/registry'

describe('app icon registry', () => {
  it('includes aliases used by creative studio session switcher', () => {
    expect(iconRegistry.layers).toBeDefined()
    expect(iconRegistry.pencil).toBeDefined()
  })
})
