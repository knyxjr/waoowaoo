'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import { GlassSurface, GlassButton } from '@/components/ui/primitives'
import { useImageGenerate, type ImageTask } from '../hooks/useImageGenerate'
import { ART_STYLES, ASPECT_RATIO_CONFIGS } from '@/lib/constants'
import { loadPromptSetting, loadCustomArtStyles, getEffectiveArtStylePrompt } from './PromptSettingsModal'
import ImageResultGrid from './ImageResultGrid'
import { useMediaUpload } from '../hooks/useMediaUpload'
import MediaUploadZone from './video/MediaUploadZone'
import type { UserModelOption } from '@/lib/query/hooks/useUserModels'

const IMAGE_SIZES = ['', '1K', '2K', '4K'] as const

interface ImageStudioProps {
    sessionId: string
    model: string
    onModelChange: (v: string) => void
    artStyle: string
    onArtStyleChange: (v: string) => void
    ratio: string
    onRatioChange: (v: string) => void
    batchCount: number
    onBatchCountChange: (v: number) => void
    imageSize: string
    onImageSizeChange: (v: string) => void
    imageModels: UserModelOption[]
    onUseForVideo: (imageUrl: string) => void
    onOpenPromptSettings: () => void
    showProviderName?: boolean
}

export default function ImageStudio({
    sessionId,
    model, onModelChange,
    artStyle, onArtStyleChange,
    ratio, onRatioChange,
    batchCount, onBatchCountChange,
    imageSize, onImageSizeChange,
    imageModels,
    onUseForVideo,
    onOpenPromptSettings,
    showProviderName,
}: ImageStudioProps) {
    const t = useTranslations('creativeStudio.image')
    const { tasks, generate, removeTask, retryTask, retryAllFailed, renameTask } = useImageGenerate(sessionId)
    const [prompt, setPrompt] = useState('')
    const refImages = useMediaUpload({ maxFiles: 14, accept: 'image/*' })

    // Auto-select first model
    useEffect(() => {
        if (imageModels.length > 0 && !imageModels.some(m => m.value === model)) {
            onModelChange(imageModels[0].value)
        }
    }, [imageModels, model, onModelChange])

    const isSubmitting = tasks.some(t => t.status === 'submitting')
    const canSubmit = !!prompt.trim() && !!model && !isSubmitting && !refImages.isUploading

    const handleGenerate = useCallback(async () => {
        if (!canSubmit) return
        const defaultPrompt = loadPromptSetting('imagePrompt')
        const customStyles = loadCustomArtStyles()
        const customArtStylePrompt = artStyle ? getEffectiveArtStylePrompt(artStyle, customStyles) : undefined
        const hasCustomStyle = artStyle ? !!customStyles[artStyle] : false

        const finalPrompt = defaultPrompt
            ? `${defaultPrompt}\n${prompt.trim()}`
            : prompt.trim()

        const params = {
            modelKey: model,
            prompt: finalPrompt,
            artStyle: hasCustomStyle ? undefined : (artStyle || undefined),
            customArtStylePrompt: hasCustomStyle ? customArtStylePrompt : undefined,
            aspectRatio: ratio,
            imageSize: imageSize || undefined,
            referenceImages: refImages.readyKeys.length > 0 ? refImages.readyKeys : undefined,
        }
        const promises = Array.from({ length: batchCount }, () => generate(params))
        await Promise.allSettled(promises)
    }, [canSubmit, model, prompt, artStyle, ratio, batchCount, imageSize, refImages.readyKeys, generate])

    const handleEdit = useCallback(async (task: ImageTask, editPrompt: string) => {
        if (!task.imageUrl || !editPrompt.trim()) return
        await generate({
            modelKey: model,
            prompt: editPrompt.trim(),
            artStyle: artStyle || undefined,
            aspectRatio: ratio,
            imageSize: imageSize || undefined,
            referenceImages: [task.imageUrl],
        })
    }, [model, artStyle, ratio, imageSize, generate])

    const ratioKeys = Object.keys(ASPECT_RATIO_CONFIGS) as Array<keyof typeof ASPECT_RATIO_CONFIGS>

    return (
        <div className="flex gap-6">
            <div className="w-[420px] shrink-0">
                <GlassSurface variant="elevated" className="space-y-4">
                    {/* Header with prompt settings */}
                    <div className="flex items-center justify-between -mb-2">
                        <label className="text-xs font-medium text-[var(--glass-text-secondary)]">{t('model')}</label>
                        <button
                            onClick={onOpenPromptSettings}
                            className="text-[10px] text-[var(--glass-text-tertiary)] hover:text-[var(--glass-tone-info-fg)] transition-colors flex items-center gap-1"
                        >
                            <AppIcon name="edit" className="w-3 h-3" />
                            提示词
                        </button>
                    </div>

                    {/* Model Selector */}
                    <div className="space-y-1.5">
                        {imageModels.length === 0 ? (
                            <p className="text-xs text-[var(--glass-text-tertiary)]">{t('noModels')}</p>
                        ) : (
                            <select
                                value={model}
                                onChange={e => onModelChange(e.target.value)}
                                className="w-full h-9 rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-primary)] text-sm px-3 appearance-none cursor-pointer"
                            >
                                {imageModels.map(m => (
                                    <option key={m.value} value={m.value}>
                                        {showProviderName && m.providerName ? `${m.providerName} · ${m.label}` : m.label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Prompt */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--glass-text-secondary)]">{t('prompt')}</label>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder={t('promptPlaceholder')}
                            rows={3}
                            className="w-full rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-2 text-sm text-[var(--glass-text-primary)] placeholder:text-[var(--glass-text-tertiary)] focus:border-[var(--glass-tone-info-fg)] focus:outline-none resize-none"
                        />
                    </div>

                    {/* Reference Images */}
                    <MediaUploadZone
                        label={t('referenceImages')}
                        hint={t('referenceImagesHint')}
                        files={refImages.files}
                        maxFiles={14}
                        accept="image/*"
                        onTriggerPicker={refImages.triggerPicker}
                        onRemove={refImages.removeFile}
                        onDrop={refImages.addFiles}
                    />

                    {/* Art Style */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--glass-text-secondary)]">{t('artStyle')}</label>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => onArtStyleChange('')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                                    !artStyle
                                        ? 'border-[var(--glass-tone-info-fg)] bg-[var(--glass-tone-info-fg)]/10 text-[var(--glass-tone-info-fg)]'
                                        : 'border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-text-tertiary)]'
                                }`}
                            >
                                {t('artStyleNone')}
                            </button>
                            {ART_STYLES.map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => onArtStyleChange(s.value)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                                        artStyle === s.value
                                            ? 'border-[var(--glass-tone-info-fg)] bg-[var(--glass-tone-info-fg)]/10 text-[var(--glass-tone-info-fg)]'
                                            : 'border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-text-tertiary)]'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--glass-text-secondary)]">{t('aspectRatio')}</label>
                        <div className="flex flex-wrap gap-1.5">
                            {ratioKeys.map(r => (
                                <button
                                    key={r}
                                    onClick={() => onRatioChange(r)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                                        ratio === r
                                            ? 'border-[var(--glass-tone-info-fg)] bg-[var(--glass-tone-info-fg)]/10 text-[var(--glass-tone-info-fg)]'
                                            : 'border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-text-tertiary)]'
                                    }`}
                                >
                                    {ASPECT_RATIO_CONFIGS[r].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Image Size */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--glass-text-secondary)]">{t('imageSize')}</label>
                        <div className="flex flex-wrap gap-1.5">
                            {IMAGE_SIZES.map(s => (
                                <button
                                    key={s || 'auto'}
                                    onClick={() => onImageSizeChange(s)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                                        imageSize === s
                                            ? 'border-[var(--glass-tone-info-fg)] bg-[var(--glass-tone-info-fg)]/10 text-[var(--glass-tone-info-fg)]'
                                            : 'border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-text-tertiary)]'
                                    }`}
                                >
                                    {s || t('imageSizeAuto')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Batch + Generate */}
                    <div className="flex gap-2 items-center">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <label className="text-xs text-[var(--glass-text-secondary)]">{t('count')}</label>
                            <select
                                value={batchCount}
                                onChange={e => onBatchCountChange(Number(e.target.value))}
                                className="w-14 h-9 rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-primary)] text-sm text-center appearance-none cursor-pointer"
                            >
                                {[1, 2, 3, 4].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                        <GlassButton
                            variant="primary"
                            size="lg"
                            className="flex-1"
                            disabled={!canSubmit}
                            onClick={handleGenerate}
                        >
                            {isSubmitting
                                ? t('generating')
                                : batchCount > 1
                                    ? t('generateBatch', { count: batchCount })
                                    : t('generate')}
                        </GlassButton>
                    </div>
                </GlassSurface>
            </div>

            <div className="flex-1 min-w-0">
                <ImageResultGrid
                    tasks={tasks}
                    onRemove={removeTask}
                    onRetry={retryTask}
                    onRetryAll={retryAllFailed}
                    onEdit={handleEdit}
                    onUseForVideo={onUseForVideo}
                    onRename={renameTask}
                />
            </div>
        </div>
    )
}
