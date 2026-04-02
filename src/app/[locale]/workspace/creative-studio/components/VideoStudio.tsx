'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import { GlassSurface, GlassButton } from '@/components/ui/primitives'
import MediaUploadZone from './video/MediaUploadZone'
import VideoParamsSection from './video/VideoParamsSection'
import PromptInput from './video/PromptInput'
import ResultPanel from './video/ResultPanel'
import { useMediaUpload } from '../hooks/useMediaUpload'
import { useVideoGenerate } from '../hooks/useVideoGenerate'
import { loadPromptSetting } from './PromptSettingsModal'
import type { UserModelOption } from '@/lib/query/hooks/useUserModels'

type GenerationMode = 'textToVideo' | 'imageToVideo' | 'multiRef' | 'videoEdit' | 'videoExtend'
const MODES: GenerationMode[] = ['textToVideo', 'imageToVideo', 'multiRef', 'videoEdit', 'videoExtend']

interface VideoStudioProps {
    sessionId: string
    model: string
    onModelChange: (v: string) => void
    resolution: string
    onResolutionChange: (v: string) => void
    ratio: string
    onRatioChange: (v: string) => void
    duration: number
    onDurationChange: (v: number) => void
    generateAudio: boolean
    onGenerateAudioChange: (v: boolean) => void
    webSearch: boolean
    onWebSearchChange: (v: boolean) => void
    seed: string
    onSeedChange: (v: string) => void
    batchCount: number
    onBatchCountChange: (v: number) => void
    videoMode: GenerationMode
    onVideoModeChange: (v: GenerationMode) => void
    videoModels: UserModelOption[]
    pendingImageUrl: string | null
    onPendingImageConsumed: () => void
    onOpenPromptSettings: () => void
    showProviderName?: boolean
}

export type { GenerationMode }

export default function VideoStudio({
    sessionId,
    model, onModelChange,
    resolution, onResolutionChange,
    ratio, onRatioChange,
    duration, onDurationChange,
    generateAudio, onGenerateAudioChange,
    webSearch, onWebSearchChange,
    seed, onSeedChange,
    batchCount, onBatchCountChange,
    videoMode: mode, onVideoModeChange: setMode,
    videoModels,
    pendingImageUrl,
    onPendingImageConsumed,
    onOpenPromptSettings,
    showProviderName,
}: VideoStudioProps) {
    const t = useTranslations('seedanceStudio')

    // Auto-select first model if current not in list
    useEffect(() => {
        if (videoModels.length > 0 && !videoModels.some(m => m.value === model)) {
            onModelChange(videoModels[0].value)
        }
    }, [videoModels, model, onModelChange])

    const [prompt, setPrompt] = useState('')

    // Handle pending image from image tab
    useEffect(() => {
        if (pendingImageUrl && mode === 'imageToVideo') {
            firstFrame.addFromUrl(pendingImageUrl, 'from-image-studio.png')
            onPendingImageConsumed()
        }
    }, [pendingImageUrl])

    // Media uploads
    const firstFrame = useMediaUpload({ maxFiles: 1, accept: 'image/*' })
    const lastFrame = useMediaUpload({ maxFiles: 1, accept: 'image/*' })
    const refImages = useMediaUpload({ maxFiles: 9, accept: 'image/*' })
    const refVideos = useMediaUpload({ maxFiles: 3, accept: 'video/*', maxSizeMB: 100 })
    const refAudios = useMediaUpload({ maxFiles: 3, accept: 'audio/*', maxSizeMB: 50 })
    const editRefVideo = useMediaUpload({ maxFiles: 1, accept: 'video/*', maxSizeMB: 100 })
    const editRefImage = useMediaUpload({ maxFiles: 1, accept: 'image/*' })
    const extendRefVideos = useMediaUpload({ maxFiles: 3, accept: 'video/*', maxSizeMB: 100 })

    const { tasks, generate, removeTask, retryTask, retryAllFailed, renameTask } = useVideoGenerate(sessionId)

    const isUploading = firstFrame.isUploading || lastFrame.isUploading ||
        refImages.isUploading || refVideos.isUploading || refAudios.isUploading ||
        editRefVideo.isUploading || editRefImage.isUploading || extendRefVideos.isUploading
    const isSubmitting = tasks.some(t => t.status === 'submitting')

    const promptPlaceholder = mode === 'videoEdit'
        ? t('prompt.editPlaceholder')
        : mode === 'videoExtend'
            ? t('prompt.extendPlaceholder')
            : t('prompt.placeholder')

    const handleGenerate = useCallback(async () => {
        const content: Array<Record<string, unknown>> = []

        if (mode === 'imageToVideo') {
            for (const key of firstFrame.readyKeys) content.push({ type: 'image_url', image_url: { url: key }, role: 'first_frame' })
            for (const key of lastFrame.readyKeys) content.push({ type: 'image_url', image_url: { url: key }, role: 'last_frame' })
        } else if (mode === 'multiRef') {
            for (const key of refImages.readyKeys) content.push({ type: 'image_url', image_url: { url: key }, role: 'reference_image' })
            for (const key of refVideos.readyKeys) content.push({ type: 'video_url', video_url: { url: key }, role: 'reference_video' })
            for (const key of refAudios.readyKeys) content.push({ type: 'audio_url', audio_url: { url: key }, role: 'reference_audio' })
        } else if (mode === 'videoEdit') {
            for (const key of editRefVideo.readyKeys) content.push({ type: 'video_url', video_url: { url: key }, role: 'reference_video' })
            for (const key of editRefImage.readyKeys) content.push({ type: 'image_url', image_url: { url: key }, role: 'reference_image' })
        } else if (mode === 'videoExtend') {
            for (const key of extendRefVideos.readyKeys) content.push({ type: 'video_url', video_url: { url: key }, role: 'reference_video' })
        }

        if (!prompt.trim() && content.length === 0) return

        // Auto-append media filename mappings
        const mappings: string[] = []
        let imgIdx = 1, vidIdx = 1
        const appendImageNames = (files: typeof firstFrame.files) => {
            for (const f of files.filter(f => f.cosKey && !f.error)) {
                mappings.push(`图片${imgIdx}：${f.file.name.replace(/\.[^.]+$/, '')}`)
                imgIdx++
            }
        }
        const appendVideoNames = (files: typeof refVideos.files) => {
            for (const f of files.filter(f => f.cosKey && !f.error)) {
                mappings.push(`视频${vidIdx}：${f.file.name.replace(/\.[^.]+$/, '')}`)
                vidIdx++
            }
        }

        if (mode === 'imageToVideo') { appendImageNames(firstFrame.files); appendImageNames(lastFrame.files) }
        else if (mode === 'multiRef') { appendImageNames(refImages.files); appendVideoNames(refVideos.files) }
        else if (mode === 'videoEdit') { appendVideoNames(editRefVideo.files); appendImageNames(editRefImage.files) }
        else if (mode === 'videoExtend') { appendVideoNames(extendRefVideos.files) }

        const finalPrompt = mappings.length > 0 ? `${prompt}\n${mappings.join('。')}` : prompt

        // Prepend default video prompt
        const defaultVideoPrompt = loadPromptSetting('videoPrompt')
        const fullPrompt = defaultVideoPrompt && finalPrompt
            ? `${defaultVideoPrompt}\n${finalPrompt}`
            : defaultVideoPrompt || finalPrompt

        const params = {
            model,
            prompt: fullPrompt,
            content,
            resolution,
            ratio: ratio === 'adaptive' ? undefined : ratio,
            duration: duration === -1 ? undefined : duration,
            generateAudio,
            seed: seed ? Number(seed) : undefined,
            tools: webSearch && mode === 'textToVideo' ? [{ type: 'web_search' as const }] : undefined,
        }

        const promises = Array.from({ length: batchCount }, () => generate(params))
        await Promise.allSettled(promises)
    }, [mode, model, prompt, resolution, ratio, duration, generateAudio, webSearch, seed, batchCount,
        firstFrame, lastFrame, refImages, refVideos, refAudios, editRefVideo, editRefImage, extendRefVideos, generate])

    const canSubmit = (() => {
        if (isUploading) return false
        switch (mode) {
            case 'textToVideo': return !!prompt.trim()
            case 'imageToVideo': return firstFrame.readyKeys.length > 0
            case 'multiRef': return !!prompt.trim() || refImages.readyKeys.length > 0 || refVideos.readyKeys.length > 0
            case 'videoEdit': return editRefVideo.readyKeys.length > 0 && !!prompt.trim()
            case 'videoExtend': return extendRefVideos.readyKeys.length > 0
        }
    })()

    return (
        <div className="flex gap-6">
            <div className="w-[420px] shrink-0">
                <GlassSurface variant="elevated" className="space-y-4">
                    {/* Model Selector */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-[var(--glass-text-secondary)]">{t('model.label')}</label>
                            <button
                                onClick={onOpenPromptSettings}
                                className="text-[10px] text-[var(--glass-text-tertiary)] hover:text-[var(--glass-tone-info-fg)] transition-colors flex items-center gap-1"
                            >
                                <AppIcon name="edit" className="w-3 h-3" />
                                提示词
                            </button>
                        </div>
                        {videoModels.length === 0 ? (
                            <p className="text-xs text-[var(--glass-text-tertiary)]">未配置视频模型</p>
                        ) : (
                            <select
                                value={model}
                                onChange={e => onModelChange(e.target.value)}
                                className="w-full h-9 rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-primary)] text-sm px-3 appearance-none cursor-pointer"
                            >
                                {videoModels.map(m => (
                                    <option key={m.value} value={m.value}>
                                        {showProviderName && m.providerName ? `${m.providerName} · ${m.label}` : m.label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Mode Selector */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--glass-text-secondary)]">{t('mode.label')}</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {MODES.map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`px-2.5 py-2 rounded-lg text-left transition-all border ${
                                        mode === m
                                            ? 'border-[var(--glass-tone-info-fg)] bg-[var(--glass-tone-info-fg)]/10 text-[var(--glass-tone-info-fg)]'
                                            : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-text-tertiary)]'
                                    }`}
                                >
                                    <div className="text-xs font-medium">{t(`mode.${m}`)}</div>
                                    <div className="text-[10px] opacity-70 mt-0.5">{t(`mode.${m}Desc`)}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <PromptInput value={prompt} onChange={setPrompt} placeholder={promptPlaceholder} />

                    {/* Mode-specific upload zones */}
                    {mode === 'imageToVideo' && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-[var(--glass-text-primary)]">{t('firstLastFrame.title')}</h3>
                            <p className="text-[10px] text-[var(--glass-text-tertiary)]">{t('firstLastFrame.hint')}</p>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <MediaUploadZone label={t('firstLastFrame.firstFrame')} hint="" files={firstFrame.files} maxFiles={1} accept="image/*" onTriggerPicker={firstFrame.triggerPicker} onRemove={firstFrame.removeFile} onDrop={firstFrame.addFiles} />
                                </div>
                                <div className="flex-1">
                                    <MediaUploadZone label={t('firstLastFrame.lastFrame')} hint="" files={lastFrame.files} maxFiles={1} accept="image/*" onTriggerPicker={lastFrame.triggerPicker} onRemove={lastFrame.removeFile} onDrop={lastFrame.addFiles} />
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === 'multiRef' && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-[var(--glass-text-primary)]">{t('reference.title')}</h3>
                            <MediaUploadZone label={t('reference.images')} hint={t('reference.imagesHint')} files={refImages.files} maxFiles={9} accept="image/*" onTriggerPicker={refImages.triggerPicker} onRemove={refImages.removeFile} onDrop={refImages.addFiles} />
                            <MediaUploadZone label={t('reference.videos')} hint={t('reference.videosHint')} files={refVideos.files} maxFiles={3} accept="video/*" onTriggerPicker={refVideos.triggerPicker} onRemove={refVideos.removeFile} onDrop={refVideos.addFiles} previewType="video" />
                            <MediaUploadZone label={t('reference.audios')} hint={t('reference.audiosHint')} files={refAudios.files} maxFiles={3} accept="audio/*" onTriggerPicker={refAudios.triggerPicker} onRemove={refAudios.removeFile} onDrop={refAudios.addFiles} previewType="audio" />
                        </div>
                    )}

                    {mode === 'videoEdit' && (
                        <div className="space-y-2">
                            <MediaUploadZone label={t('videoEdit.refVideo')} hint={t('videoEdit.refVideoHint')} files={editRefVideo.files} maxFiles={1} accept="video/*" onTriggerPicker={editRefVideo.triggerPicker} onRemove={editRefVideo.removeFile} onDrop={editRefVideo.addFiles} previewType="video" />
                            <MediaUploadZone label={t('videoEdit.refImage')} hint={t('videoEdit.refImageHint')} files={editRefImage.files} maxFiles={1} accept="image/*" onTriggerPicker={editRefImage.triggerPicker} onRemove={editRefImage.removeFile} onDrop={editRefImage.addFiles} />
                        </div>
                    )}

                    {mode === 'videoExtend' && (
                        <div className="space-y-2">
                            <MediaUploadZone label={t('videoExtend.refVideos')} hint={t('videoExtend.refVideosHint')} files={extendRefVideos.files} maxFiles={3} accept="video/*" onTriggerPicker={extendRefVideos.triggerPicker} onRemove={extendRefVideos.removeFile} onDrop={extendRefVideos.addFiles} previewType="video" />
                        </div>
                    )}

                    <VideoParamsSection
                        resolution={resolution} ratio={ratio} duration={duration}
                        generateAudio={generateAudio} webSearch={webSearch} seed={seed}
                        onResolutionChange={onResolutionChange} onRatioChange={onRatioChange}
                        onDurationChange={onDurationChange} onGenerateAudioChange={onGenerateAudioChange}
                        onWebSearchChange={onWebSearchChange} onSeedChange={onSeedChange}
                    />

                    <div className="flex gap-2 items-center">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <label className="text-xs text-[var(--glass-text-secondary)]">{t('generate.count')}</label>
                            <select value={batchCount} onChange={e => onBatchCountChange(Number(e.target.value))} className="w-14 h-9 rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-primary)] text-sm text-center appearance-none cursor-pointer">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <GlassButton variant="primary" size="lg" className="flex-1" disabled={!canSubmit} onClick={handleGenerate}>
                            {isSubmitting ? t('generate.submitting') : batchCount > 1 ? t('generate.submitBatch', { count: batchCount }) : t('generate.submit')}
                        </GlassButton>
                    </div>
                </GlassSurface>
            </div>

            <div className="flex-1 min-w-0">
                <ResultPanel tasks={tasks} onRemove={removeTask} onRetry={retryTask} onRetryAll={retryAllFailed} onRename={renameTask} />
            </div>
        </div>
    )
}
