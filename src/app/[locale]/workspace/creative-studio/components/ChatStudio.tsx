'use client'

import { useMemo, useState, useEffect, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'
import { useCreativeChat } from '../hooks/useCreativeChat'
import { extractMessageContent } from '@/components/assistant/AssistantChatModal'
import { loadChatSystemPrompt, DEFAULT_CHAT_PROMPT } from './PromptSettingsModal'
import type { UserModelOption } from '@/lib/query/hooks/useUserModels'

interface ChatStudioProps {
    sessionId: string
    chatModel: string
    onChatModelChange: (v: string) => void
    llmModels: UserModelOption[]
    onOpenPromptSettings: () => void
    externalSystemPrompt?: string
    showProviderName?: boolean
}

export default function ChatStudio({ sessionId, chatModel, onChatModelChange, llmModels, onOpenPromptSettings, externalSystemPrompt, showProviderName }: ChatStudioProps) {
    const t = useTranslations('creativeStudio.chat')

    // System prompt - read from localStorage, refresh when externalSystemPrompt changes (modal save)
    const [systemPrompt, setSystemPrompt] = useState(() => loadChatSystemPrompt(sessionId))

    useEffect(() => {
        setSystemPrompt(loadChatSystemPrompt(sessionId))
    }, [sessionId, externalSystemPrompt])

    // Auto-select first model
    useEffect(() => {
        if (llmModels.length > 0 && !llmModels.some(m => m.value === chatModel)) {
            onChatModelChange(llmModels[0].value)
        }
    }, [llmModels, chatModel, onChatModelChange])

    const chat = useCreativeChat({
        sessionId,
        modelKey: chatModel || undefined,
        customSystemPrompt: systemPrompt || undefined,
    })
    const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({})

    const renderedMessages = useMemo(() => {
        return chat.messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            ...extractMessageContent(msg),
        })).filter(m => m.lines.length > 0 || m.reasoningLines.length > 0)
    }, [chat.messages])

    const handleSend = () => {
        const text = chat.input.trim()
        if (!text || chat.pending) return
        chat.send(text)
    }

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-220px)] glass-surface border border-[var(--glass-stroke-base)] rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--glass-stroke-base)] px-4 py-3">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('title')}</h3>
                    {/* Model selector */}
                    {llmModels.length > 0 && (
                        <select
                            value={chatModel}
                            onChange={e => onChatModelChange(e.target.value)}
                            className="h-7 rounded-md border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-primary)] text-[11px] px-2 appearance-none cursor-pointer"
                        >
                            {llmModels.map(m => (
                                <option key={m.value} value={m.value}>
                                    {showProviderName && m.providerName ? `${m.providerName} · ${m.label}` : m.label}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenPromptSettings}
                        className="text-xs text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)] transition-colors flex items-center gap-1"
                        title="编辑系统提示词"
                    >
                        <AppIcon name="edit" className="w-3.5 h-3.5" />
                        提示词
                    </button>
                    <button onClick={chat.clear} className="text-xs text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)] transition-colors">
                        {t('clear')}
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden bg-[var(--glass-bg-soft)]">
                <Conversation className="h-full">
                    <ConversationContent className="h-full space-y-3 p-4">
                        {renderedMessages.length === 0 && (
                            <Message from="assistant">
                                <MessageContent className="max-w-[84%] rounded-2xl rounded-bl-md border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-2">
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--glass-text-tertiary)]">{t('assistant')}</div>
                                    <MessageResponse className="whitespace-pre-wrap break-words leading-relaxed">{t('welcome')}</MessageResponse>
                                </MessageContent>
                            </Message>
                        )}

                        {renderedMessages.map(msg => {
                            const isAssistant = msg.role === 'assistant'
                            return (
                                <Message key={msg.id} from={msg.role}>
                                    <MessageContent className={isAssistant
                                        ? 'max-w-[84%] rounded-2xl rounded-bl-md border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-2'
                                        : 'max-w-[84%] rounded-2xl rounded-br-md bg-[var(--brand-primary)]/15 px-3 py-2'
                                    }>
                                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--glass-text-tertiary)]">
                                            {isAssistant ? t('assistant') : t('user')}
                                        </div>

                                        {isAssistant && msg.reasoningLines.length > 0 && (
                                            <Reasoning
                                                open={Boolean(expandedReasoning[msg.id])}
                                                onOpenChange={v => setExpandedReasoning(prev => ({ ...prev, [msg.id]: v }))}
                                                className="mb-2 rounded-xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-soft)] p-2"
                                            >
                                                <ReasoningTrigger className="text-xs text-[var(--glass-text-secondary)]">
                                                    <span className="mr-2">{t('reasoning')}</span>
                                                    <span className="text-[11px] text-[var(--glass-text-tertiary)]">
                                                        {expandedReasoning[msg.id] ? t('reasoningCollapse') : t('reasoningExpand')}
                                                    </span>
                                                </ReasoningTrigger>
                                                <ReasoningContent className="space-y-1 border-t border-[var(--glass-stroke-base)] pt-2 text-xs text-[var(--glass-text-secondary)]">
                                                    {msg.reasoningLines.join('\n\n')}
                                                </ReasoningContent>
                                            </Reasoning>
                                        )}

                                        {msg.lines.map((line, i) => (
                                            <MessageResponse key={`${msg.id}-${i}`} className="whitespace-pre-wrap break-words leading-relaxed">
                                                {line}
                                            </MessageResponse>
                                        ))}
                                    </MessageContent>
                                </Message>
                            )
                        })}

                        {chat.pending && (
                            <Message from="assistant">
                                <MessageContent className="max-w-[84%] rounded-2xl rounded-bl-md border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-2">
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--glass-text-tertiary)]">{t('assistant')}</div>
                                    <MessageResponse>{t('pending')}</MessageResponse>
                                </MessageContent>
                            </Message>
                        )}
                    </ConversationContent>
                    <ConversationScrollButton />
                </Conversation>
            </div>

            {/* Input */}
            <div className="border-t border-[var(--glass-stroke-base)] px-4 py-3">
                <div className="flex items-end gap-2">
                    <textarea
                        value={chat.input}
                        onChange={e => chat.setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={t('inputPlaceholder')}
                        rows={1}
                        className="glass-input-base flex-1 px-3 py-2 text-sm resize-none max-h-32"
                        disabled={chat.pending}
                    />
                    <button
                        onClick={handleSend}
                        disabled={chat.pending || !chat.input.trim()}
                        className="glass-btn-base glass-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-60 shrink-0"
                    >
                        {chat.pending ? t('pending') : t('send')}
                    </button>
                </div>
            </div>
        </div>
    )
}
