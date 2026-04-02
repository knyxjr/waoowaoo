'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import { ART_STYLES } from '@/lib/constants'
import { sessionStorageKey } from '../hooks/useStudioSessions'

const STORAGE_KEYS = {
    imagePrompt: 'creative-studio-image-default-prompt',
    videoPrompt: 'creative-studio-video-default-prompt',
    artStyles: 'creative-studio-custom-art-styles',
    showProviderName: 'creative-studio-show-provider-name',
} as const

export const DEFAULT_CHAT_PROMPT = `你是一位专业的 AI 创意助手，擅长以下领域：

1. **图片生成提示词**：帮用户构思和优化图片生成提示词，包括场景描述、风格、构图、光影、色彩等。
2. **画面构图分析**：分析画面构图原理，提供改进建议。
3. **视频创意策划**：帮用户规划视频内容、镜头语言、转场效果。
4. **风格指导**：介绍不同艺术风格（真人、日系动漫、国漫、美漫等）的特点和适用场景。

回复规则：
- 使用用户的语言回复
- 回复简洁实用，直接给出可用的提示词或建议
- 提示词建议用中英双语给出
- 如果用户描述模糊，主动追问细节`

export function loadPromptSetting(key: keyof typeof STORAGE_KEYS): string {
    try { return localStorage.getItem(STORAGE_KEYS[key]) || '' } catch { return '' }
}

export function loadCustomArtStyles(): Record<string, string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.artStyles)
        return raw ? JSON.parse(raw) : {}
    } catch { return {} }
}

export function loadShowProviderName(): boolean {
    try { return localStorage.getItem(STORAGE_KEYS.showProviderName) === 'true' } catch { return false }
}

export function loadChatSystemPrompt(sessionId: string): string {
    try {
        return localStorage.getItem(sessionStorageKey(sessionId, 'system-prompt')) || ''
    } catch { return '' }
}

export function getEffectiveArtStylePrompt(artStyle: string, customStyles: Record<string, string>): string {
    if (customStyles[artStyle]) return customStyles[artStyle]
    const style = ART_STYLES.find(s => s.value === artStyle)
    return style?.promptZh || ''
}

type Section = 'image' | 'video' | 'chat' | 'artStyles'

interface PromptSettingsModalProps {
    open: boolean
    onClose: () => void
    sessionId: string
    initialSection?: Section
    onChatPromptChange?: (prompt: string) => void
    onShowProviderNameChange?: (show: boolean) => void
}

export default function PromptSettingsModal({ open, onClose, sessionId, initialSection, onChatPromptChange, onShowProviderNameChange }: PromptSettingsModalProps) {
    const t = useTranslations('creativeStudio.promptSettings')

    const [imagePrompt, setImagePrompt] = useState('')
    const [videoPrompt, setVideoPrompt] = useState('')
    const [chatPrompt, setChatPrompt] = useState('')
    const [artStyles, setArtStyles] = useState<Record<string, string>>({})
    const [showProviderName, setShowProviderName] = useState(false)
    const sectionRefs = {
        image: useRef<HTMLDivElement>(null),
        video: useRef<HTMLDivElement>(null),
        chat: useRef<HTMLDivElement>(null),
        artStyles: useRef<HTMLDivElement>(null),
    }

    useEffect(() => {
        if (!open) return
        setImagePrompt(loadPromptSetting('imagePrompt'))
        setVideoPrompt(loadPromptSetting('videoPrompt'))
        setChatPrompt(loadChatSystemPrompt(sessionId))
        setArtStyles(loadCustomArtStyles())
        setShowProviderName(loadShowProviderName())
    }, [open, sessionId])

    useEffect(() => {
        if (open && initialSection) {
            setTimeout(() => {
                sectionRefs[initialSection]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 100)
        }
    }, [open, initialSection])

    const handleSave = () => {
        try {
            localStorage.setItem(STORAGE_KEYS.imagePrompt, imagePrompt.trim())
            localStorage.setItem(STORAGE_KEYS.videoPrompt, videoPrompt.trim())
            const chatTrimmed = chatPrompt.trim()
            const chatToSave = chatTrimmed === DEFAULT_CHAT_PROMPT ? '' : chatTrimmed
            localStorage.setItem(sessionStorageKey(sessionId, 'system-prompt'), chatToSave)
            localStorage.setItem(STORAGE_KEYS.artStyles, JSON.stringify(artStyles))
            localStorage.setItem(STORAGE_KEYS.showProviderName, String(showProviderName))
            onChatPromptChange?.(chatToSave)
            onShowProviderNameChange?.(showProviderName)
        } catch { /* quota */ }
        onClose()
    }

    const resetChatPrompt = () => setChatPrompt(DEFAULT_CHAT_PROMPT)

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
            <div className="w-[680px] max-h-[85vh] glass-surface-modal border border-[var(--glass-stroke-base)] rounded-xl shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--glass-stroke-base)] shrink-0">
                    <h3 className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('title')}</h3>
                    <button onClick={onClose} className="text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]">
                        <AppIcon name="close" className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Image default prompt */}
                    <div ref={sectionRefs.image}>
                        <h4 className="text-xs font-semibold text-[var(--glass-text-primary)] mb-1">{t('imagePrompt')}</h4>
                        <p className="text-[10px] text-[var(--glass-text-tertiary)] mb-2">{t('imagePromptDesc')}</p>
                        <textarea
                            value={imagePrompt}
                            onChange={e => setImagePrompt(e.target.value)}
                            placeholder={t('placeholder')}
                            rows={3}
                            className="w-full rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-2 text-sm text-[var(--glass-text-primary)] placeholder:text-[var(--glass-text-tertiary)] focus:border-[var(--glass-tone-info-fg)] focus:outline-none resize-none"
                        />
                    </div>

                    {/* Video default prompt */}
                    <div ref={sectionRefs.video}>
                        <h4 className="text-xs font-semibold text-[var(--glass-text-primary)] mb-1">{t('videoPrompt')}</h4>
                        <p className="text-[10px] text-[var(--glass-text-tertiary)] mb-2">{t('videoPromptDesc')}</p>
                        <textarea
                            value={videoPrompt}
                            onChange={e => setVideoPrompt(e.target.value)}
                            placeholder={t('placeholder')}
                            rows={3}
                            className="w-full rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-2 text-sm text-[var(--glass-text-primary)] placeholder:text-[var(--glass-text-tertiary)] focus:border-[var(--glass-tone-info-fg)] focus:outline-none resize-none"
                        />
                    </div>

                    {/* Chat system prompt */}
                    <div ref={sectionRefs.chat}>
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="text-xs font-semibold text-[var(--glass-text-primary)]">{t('chatPrompt')}</h4>
                            <button onClick={resetChatPrompt} className="text-[10px] text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]">
                                {t('resetDefault')}
                            </button>
                        </div>
                        <p className="text-[10px] text-[var(--glass-text-tertiary)] mb-2">{t('chatPromptDesc')}</p>
                        <textarea
                            value={chatPrompt || DEFAULT_CHAT_PROMPT}
                            onChange={e => setChatPrompt(e.target.value)}
                            rows={8}
                            className="w-full rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-2 text-sm text-[var(--glass-text-primary)] focus:border-[var(--glass-tone-info-fg)] focus:outline-none resize-none"
                        />
                    </div>

                    {/* Custom art styles */}
                    <div ref={sectionRefs.artStyles}>
                        <h4 className="text-xs font-semibold text-[var(--glass-text-primary)] mb-1">{t('artStyles')}</h4>
                        <p className="text-[10px] text-[var(--glass-text-tertiary)] mb-2">{t('artStylesDesc')}</p>
                        <div className="space-y-2">
                            {ART_STYLES.map(style => (
                                <div key={style.value} className="flex gap-2 items-start">
                                    <span className="text-xs text-[var(--glass-text-secondary)] w-20 shrink-0 pt-2 font-medium">{style.label}</span>
                                    <textarea
                                        value={artStyles[style.value] ?? style.promptZh}
                                        onChange={e => setArtStyles(prev => ({ ...prev, [style.value]: e.target.value }))}
                                        rows={2}
                                        className="flex-1 rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-2.5 py-1.5 text-xs text-[var(--glass-text-primary)] focus:border-[var(--glass-tone-info-fg)] focus:outline-none resize-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Show provider name toggle */}
                    <div className="flex items-center justify-between py-2 border-t border-[var(--glass-stroke-base)]">
                        <div>
                            <h4 className="text-xs font-semibold text-[var(--glass-text-primary)]">{t('showProviderName')}</h4>
                            <p className="text-[10px] text-[var(--glass-text-tertiary)]">{t('showProviderNameDesc')}</p>
                        </div>
                        <button
                            onClick={() => setShowProviderName(!showProviderName)}
                            className={`relative w-9 h-5 rounded-full transition-colors ${showProviderName ? 'bg-[var(--glass-tone-info-fg)]' : 'bg-[var(--glass-bg-muted)]'}`}
                        >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showProviderName ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--glass-stroke-base)] shrink-0">
                    <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)]">
                        {t('cancel')}
                    </button>
                    <button onClick={handleSave} className="px-4 py-1.5 text-xs rounded-lg bg-[var(--glass-tone-info-fg)] text-white font-medium">
                        {t('save')}
                    </button>
                </div>
            </div>
        </div>
    )
}
