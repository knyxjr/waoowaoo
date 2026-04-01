import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiConfigTabContainer } from '@/app/[locale]/profile/components/api-config-tab/ApiConfigTabContainer'

const tabContainerMocks = vi.hoisted(() => {
  return {
    updateProviderImageChatMode: vi.fn(),
    capturedProviderListProps: null as null | Record<string, unknown>,
  }
})

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/ui/primitives', () => ({
  GlassModalShell: ({
    children,
    footer,
  }: {
    children: React.ReactNode
    footer?: React.ReactNode
  }) => createElement('div', null, children, footer),
}))

vi.mock('@/lib/task/presentation', () => ({
  resolveTaskPresentationState: () => ({ label: 'saving' }),
}))

vi.mock('@/components/ui/icons', () => ({
  AppIcon: ({ name }: { name: string }) => createElement('span', { 'data-icon': name }),
}))

vi.mock('@/app/[locale]/profile/components/api-config-tab/ApiConfigToolbar', () => ({
  ApiConfigToolbar: () => createElement('div', { 'data-toolbar': 'true' }),
}))

vi.mock('@/app/[locale]/profile/components/api-config-tab/DefaultModelCards', () => ({
  DefaultModelCards: () => createElement('div', { 'data-default-model-cards': 'true' }),
}))

vi.mock('@/app/[locale]/profile/components/api-config-tab/ApiConfigProviderList', () => ({
  ApiConfigProviderList: (props: Record<string, unknown>) => {
    tabContainerMocks.capturedProviderListProps = props
    return createElement('div', { 'data-provider-list': 'true' })
  },
}))

vi.mock('@/app/[locale]/profile/components/api-config-tab/hooks/useApiConfigFilters', () => ({
  useApiConfigFilters: () => ({
    modelProviders: [{ id: 'gemini-compatible:gm-1', name: 'Gemini Compatible' }],
    getModelsForProvider: () => [],
    getEnabledModelsByType: () => [],
  }),
}))

vi.mock('@/app/[locale]/profile/components/api-config', () => ({
  encodeModelKey: () => 'provider::model',
  getProviderDisplayName: () => 'Provider',
  parseModelKey: () => ({ provider: 'provider', modelId: 'model' }),
  useProviders: () => ({
    providers: [{ id: 'gemini-compatible:gm-1', name: 'Gemini Compatible' }],
    models: [],
    defaultModels: {},
    workflowConcurrency: { analysis: 1, image: 1, video: 1 },
    capabilityDefaults: {},
    loading: false,
    saveStatus: 'idle',
    flushConfig: async () => undefined,
    updateProviderHidden: () => undefined,
    updateProviderImageChatMode: tabContainerMocks.updateProviderImageChatMode,
    updateProviderApiKey: () => undefined,
    updateProviderBaseUrl: () => undefined,
    reorderProviders: () => undefined,
    addProvider: () => undefined,
    deleteProvider: () => undefined,
    toggleModel: () => undefined,
    deleteModel: () => undefined,
    addModel: () => undefined,
    updateModel: () => undefined,
    updateDefaultModel: () => undefined,
    batchUpdateDefaultModels: () => undefined,
    updateWorkflowConcurrency: () => undefined,
    updateCapabilityDefault: () => undefined,
  }),
}))

describe('ApiConfigTabContainer image chat mode propagation', () => {
  beforeEach(() => {
    Reflect.set(globalThis, 'React', React)
  })

  afterEach(() => {
    tabContainerMocks.updateProviderImageChatMode.mockReset()
    tabContainerMocks.capturedProviderListProps = null
    Reflect.deleteProperty(globalThis, 'React')
  })

  it('passes updateProviderImageChatMode to ApiConfigProviderList', () => {
    renderToStaticMarkup(createElement(ApiConfigTabContainer))

    expect(tabContainerMocks.capturedProviderListProps).not.toBeNull()
    expect(tabContainerMocks.capturedProviderListProps?.onUpdateImageChatMode).toBe(
      tabContainerMocks.updateProviderImageChatMode,
    )
  })
})
