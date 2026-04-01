import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomModel, Provider } from '@/app/[locale]/profile/components/api-config/types'
import { ApiConfigProviderList } from '@/app/[locale]/profile/components/api-config-tab/ApiConfigProviderList'

const providerCardCalls = vi.hoisted(() => {
  return {
    calls: [] as Array<Record<string, unknown>>,
  }
})

vi.mock('@/app/[locale]/profile/components/api-config', async () => {
  const actual = await vi.importActual<typeof import('@/app/[locale]/profile/components/api-config')>(
    '@/app/[locale]/profile/components/api-config',
  )

  return {
    ...actual,
    ProviderCard: (props: Record<string, unknown>) => {
      providerCardCalls.calls.push(props)
      const provider = props.provider as Provider
      return createElement('div', { 'data-provider-card': provider.id })
    },
  }
})

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  KeyboardSensor: function KeyboardSensor() { return null },
  PointerSensor: function PointerSensor() { return null },
  closestCenter: () => null,
  useSensor: () => ({}),
  useSensors: (...sensors: unknown[]) => sensors,
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  rectSortingStrategy: {},
  sortableKeyboardCoordinates: () => undefined,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => undefined,
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}))

vi.mock('@/components/ui/icons', () => ({
  AppIcon: ({ name }: { name: string }) => createElement('span', { 'data-icon': name }),
}))

function createProvider(overrides: Partial<Provider>): Provider {
  return {
    id: 'gemini-compatible:test-provider',
    name: 'Gemini Compatible',
    imageChatMode: false,
    ...overrides,
  }
}

function createProps(overrides: Partial<React.ComponentProps<typeof ApiConfigProviderList>> = {}): React.ComponentProps<typeof ApiConfigProviderList> {
  return {
    modelProviders: [createProvider({})],
    allModels: [] as CustomModel[],
    defaultModels: {},
    getModelsForProvider: () => [],
    onAddGeminiProvider: () => undefined,
    onToggleModel: () => undefined,
    onUpdateApiKey: () => undefined,
    onUpdateBaseUrl: () => undefined,
    onUpdateImageChatMode: () => undefined,
    onReorderProviders: () => undefined,
    onDeleteModel: () => undefined,
    onUpdateModel: () => undefined,
    onDeleteProvider: () => undefined,
    onAddModel: () => undefined,
    onFlushConfig: async () => undefined,
    onToggleProviderHidden: () => undefined,
    labels: {
      providerPool: 'Provider Pool',
      providerPoolDesc: 'Desc',
      dragToSort: 'Drag',
      dragToSortHint: 'Hint',
      hideProvider: 'Hide',
      showProvider: 'Show',
      showHiddenProviders: 'Show Hidden',
      hideHiddenProviders: 'Hide Hidden',
      hiddenProvidersPrefix: 'Hidden',
      addGeminiProvider: 'Add',
    },
    ...overrides,
  }
}

describe('ApiConfigProviderList image chat mode propagation', () => {
  beforeEach(() => {
    Reflect.set(globalThis, 'React', React)
  })

  afterEach(() => {
    providerCardCalls.calls = []
    vi.restoreAllMocks()
    Reflect.deleteProperty(globalThis, 'React')
  })

  it('passes onUpdateImageChatMode to visible provider cards', () => {
    const onUpdateImageChatMode = vi.fn()

    renderToStaticMarkup(
      createElement(ApiConfigProviderList, createProps({ onUpdateImageChatMode })),
    )

    expect(providerCardCalls.calls).toHaveLength(1)
    expect(providerCardCalls.calls[0]?.onUpdateImageChatMode).toBe(onUpdateImageChatMode)
  })
})
