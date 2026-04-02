'use client'

import { useAssistantChat, type UseAssistantChatResult } from '@/components/assistant/useAssistantChat'
import { useLocale } from 'next-intl'

interface UseCreativeChatParams {
    sessionId: string
    modelKey?: string
    customSystemPrompt?: string
}

export function useCreativeChat({ sessionId, modelKey, customSystemPrompt }: UseCreativeChatParams): UseAssistantChatResult {
    const locale = useLocale()
    return useAssistantChat({
        assistantId: 'creative-studio',
        context: {
            locale,
            ...(modelKey ? { modelKey } : {}),
            ...(customSystemPrompt ? { customSystemPrompt } : {}),
        },
        enabled: true,
    })
}
