'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import { useUserModels } from '@/lib/query/hooks/useUserModels'
import ImageStudio from './components/ImageStudio'
import VideoStudio, { type GenerationMode } from './components/VideoStudio'
import ChatStudio from './components/ChatStudio'
import SessionSwitcher from './components/SessionSwitcher'
import PromptSettingsModal, { loadShowProviderName } from './components/PromptSettingsModal'
import { useStudioSessions } from './hooks/useStudioSessions'

type Tab = 'image' | 'video' | 'chat'
type PromptSection = 'image' | 'video' | 'chat' | 'artStyles'

const CONFIG_KEY = 'creative-studio-config'

interface SavedConfig {
    activeTab: Tab
    imageModel: string
    artStyle: string
    imageRatio: string
    imageBatchCount: number
    imageSize: string
    videoModel: string
    videoResolution: string
    videoRatio: string
    videoDuration: number
    videoGenerateAudio: boolean
    videoWebSearch: boolean
    videoSeed: string
    videoBatchCount: number
    videoMode: GenerationMode
    chatModel: string
}

function loadConfig(): Partial<SavedConfig> {
    try {
        const raw = localStorage.getItem(CONFIG_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch { return {} }
}

function saveConfig(cfg: SavedConfig) {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch { /* quota */ }
}

export default function CreativeStudioWorkspace() {
    const t = useTranslations('creativeStudio')
    const { data: userModels } = useUserModels()

    // Session management
    const { sessions, activeSession, activeId, switchSession, createSession, renameSession, deleteSession } = useStudioSessions()

    const [saved] = useState(() => loadConfig())
    const [activeTab, setActiveTab] = useState<Tab>(saved.activeTab ?? 'chat')

    // Image state
    const [imageModel, setImageModel] = useState(saved.imageModel ?? '')
    const [artStyle, setArtStyle] = useState(saved.artStyle ?? '')
    const [imageRatio, setImageRatio] = useState(saved.imageRatio ?? '1:1')
    const [imageBatchCount, setImageBatchCount] = useState(saved.imageBatchCount ?? 1)
    const [imageSize, setImageSize] = useState(saved.imageSize ?? '')

    // Video state
    const [videoModel, setVideoModel] = useState(saved.videoModel ?? '')
    const [videoResolution, setVideoResolution] = useState(saved.videoResolution ?? '720p')
    const [videoRatio, setVideoRatio] = useState(saved.videoRatio ?? '16:9')
    const [videoDuration, setVideoDuration] = useState(saved.videoDuration ?? -1)
    const [videoGenerateAudio, setVideoGenerateAudio] = useState(saved.videoGenerateAudio ?? false)
    const [videoWebSearch, setVideoWebSearch] = useState(saved.videoWebSearch ?? false)
    const [videoSeed, setVideoSeed] = useState(saved.videoSeed ?? '')
    const [videoBatchCount, setVideoBatchCount] = useState(saved.videoBatchCount ?? 1)
    const [videoMode, setVideoMode] = useState<GenerationMode>(saved.videoMode ?? 'textToVideo')

    // Chat state
    const [chatModel, setChatModel] = useState(saved.chatModel ?? '')

    // Prompt settings modal
    const [showPromptSettings, setShowPromptSettings] = useState(false)
    const [promptSection, setPromptSection] = useState<PromptSection | undefined>()

    // Image → Video transfer
    const [pendingImageForVideo, setPendingImageForVideo] = useState<string | null>(null)

    // Chat system prompt (synced from modal)
    const [chatSystemPrompt, setChatSystemPrompt] = useState('')

    // Show provider name in model selectors
    const [showProviderName, setShowProviderName] = useState(() => loadShowProviderName())

    const openPromptSettings = useCallback((section?: PromptSection) => {
        setPromptSection(section)
        setShowPromptSettings(true)
    }, [])

    const handleUseForVideo = useCallback((imageUrl: string) => {
        setPendingImageForVideo(imageUrl)
        setVideoMode('imageToVideo')
        setActiveTab('video')
    }, [])

    // Persist config
    useEffect(() => {
        saveConfig({
            activeTab, imageModel, artStyle, imageRatio, imageBatchCount, imageSize,
            videoModel, videoResolution, videoRatio, videoDuration, videoGenerateAudio,
            videoWebSearch, videoSeed, videoBatchCount, videoMode, chatModel,
        })
    }, [activeTab, imageModel, artStyle, imageRatio, imageBatchCount, imageSize,
        videoModel, videoResolution, videoRatio, videoDuration, videoGenerateAudio,
        videoWebSearch, videoSeed, videoBatchCount, videoMode, chatModel])

    const tabCss = (tab: Tab) => [
        'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
        activeTab === tab
            ? 'border-[var(--glass-tone-info-fg)] bg-[var(--glass-tone-info-fg)]/10 text-[var(--glass-tone-info-fg)]'
            : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-text-tertiary)]',
    ].join(' ')

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">{t('title')}</h1>
                    <p className="text-sm text-[var(--glass-text-secondary)] mt-1">{t('subtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openPromptSettings()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-text-tertiary)] transition-all"
                        title={t('promptSettings.title')}
                    >
                        <AppIcon name="edit" className="w-3.5 h-3.5" />
                        {t('promptSettings.title')}
                    </button>
                    <SessionSwitcher
                        sessions={sessions}
                        activeId={activeId}
                        onSwitch={switchSession}
                        onCreate={createSession}
                        onRename={renameSession}
                        onDelete={deleteSession}
                    />
                </div>
            </div>

            <div className="flex gap-2 mb-5">
                <button onClick={() => setActiveTab('chat')} className={tabCss('chat')}>
                    <AppIcon name="brain" className="w-4 h-4" />
                    {t('tabs.chat')}
                </button>
                <button onClick={() => setActiveTab('image')} className={tabCss('image')}>
                    <AppIcon name="image" className="w-4 h-4" />
                    {t('tabs.image')}
                </button>
                <button onClick={() => setActiveTab('video')} className={tabCss('video')}>
                    <AppIcon name="film" className="w-4 h-4" />
                    {t('tabs.video')}
                </button>
            </div>

            {activeTab === 'chat' && (
                <ChatStudio
                    sessionId={activeId}
                    chatModel={chatModel}
                    onChatModelChange={setChatModel}
                    llmModels={userModels?.llm ?? []}
                    onOpenPromptSettings={() => openPromptSettings('chat')}
                    externalSystemPrompt={chatSystemPrompt}
                    showProviderName={showProviderName}
                />
            )}
            {activeTab === 'image' && (
                <ImageStudio
                    sessionId={activeId}
                    model={imageModel} onModelChange={setImageModel}
                    artStyle={artStyle} onArtStyleChange={setArtStyle}
                    ratio={imageRatio} onRatioChange={setImageRatio}
                    batchCount={imageBatchCount} onBatchCountChange={setImageBatchCount}
                    imageSize={imageSize} onImageSizeChange={setImageSize}
                    imageModels={userModels?.image ?? []}
                    onUseForVideo={handleUseForVideo}
                    onOpenPromptSettings={() => openPromptSettings('image')}
                    showProviderName={showProviderName}
                />
            )}
            {activeTab === 'video' && (
                <VideoStudio
                    sessionId={activeId}
                    model={videoModel} onModelChange={setVideoModel}
                    resolution={videoResolution} onResolutionChange={setVideoResolution}
                    ratio={videoRatio} onRatioChange={setVideoRatio}
                    duration={videoDuration} onDurationChange={setVideoDuration}
                    generateAudio={videoGenerateAudio} onGenerateAudioChange={setVideoGenerateAudio}
                    webSearch={videoWebSearch} onWebSearchChange={setVideoWebSearch}
                    seed={videoSeed} onSeedChange={setVideoSeed}
                    batchCount={videoBatchCount} onBatchCountChange={setVideoBatchCount}
                    videoMode={videoMode} onVideoModeChange={setVideoMode}
                    videoModels={userModels?.video ?? []}
                    pendingImageUrl={pendingImageForVideo}
                    onPendingImageConsumed={() => setPendingImageForVideo(null)}
                    onOpenPromptSettings={() => openPromptSettings('video')}
                    showProviderName={showProviderName}
                />
            )}

            <PromptSettingsModal
                open={showPromptSettings}
                onClose={() => setShowPromptSettings(false)}
                sessionId={activeId}
                initialSection={promptSection}
                onChatPromptChange={setChatSystemPrompt}
                onShowProviderNameChange={setShowProviderName}
            />
        </div>
    )
}
