'use client'

import { useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import type { ImageTask } from '../hooks/useImageGenerate'

interface ImageResultGridProps {
    tasks: ImageTask[]
    onRemove: (id: string) => void
    onRetry: (id: string) => void
    onRetryAll: () => void
    onEdit: (task: ImageTask, editPrompt: string) => void
    onUseForVideo: (imageUrl: string) => void
    onRename: (id: string, name: string) => void
}

export default function ImageResultGrid({ tasks, onRemove, onRetry, onRetryAll, onEdit, onUseForVideo, onRename }: ImageResultGridProps) {
    const t = useTranslations('creativeStudio.image')
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
    const [editPrompt, setEditPrompt] = useState('')
    const [renamingTaskId, setRenamingTaskId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [isDownloadingAll, setIsDownloadingAll] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null)

    const succeededTasks = tasks.filter(t => t.status === 'succeeded' && t.imageUrl)
    const runningCount = tasks.filter(t => t.status === 'submitting').length
    const completedCount = tasks.filter(t => t.status === 'succeeded').length
    const failedCount = tasks.filter(t => t.status === 'failed').length

    const handleDownloadOne = useCallback(async (imageUrl: string, task: ImageTask) => {
        try {
            const res = await fetch(imageUrl)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${task.customName || `creative-${task.id.slice(0, 8)}`}.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch { window.open(imageUrl, '_blank') }
    }, [])

    const handleDownloadAll = useCallback(async () => {
        if (succeededTasks.length === 0) return
        setIsDownloadingAll(true)
        setDownloadProgress({ current: 0, total: succeededTasks.length })
        try {
            const JSZip = (await import('jszip')).default
            const zip = new JSZip()
            let failedDownloads = 0
            for (let i = 0; i < succeededTasks.length; i++) {
                const task = succeededTasks[i]
                setDownloadProgress({ current: i + 1, total: succeededTasks.length })
                try {
                    const res = await fetch(task.imageUrl!)
                    if (!res.ok) { failedDownloads++; continue }
                    const blob = await res.blob()
                    zip.file(`${task.customName || `creative-${task.id.slice(0, 8)}`}-${i + 1}.png`, blob)
                } catch { failedDownloads++ }
            }
            if (failedDownloads === succeededTasks.length) {
                alert(t('downloadAllFailed'))
                return
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' })
            const url = URL.createObjectURL(zipBlob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'creative-studio-images.zip'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            if (failedDownloads > 0) {
                alert(t('downloadPartialFailed', { count: failedDownloads }))
            }
        } catch { /* ignore */ } finally {
            setIsDownloadingAll(false)
            setDownloadProgress(null)
        }
    }, [succeededTasks, t])

    const handleStartEdit = useCallback((taskId: string) => {
        setEditingTaskId(taskId)
        setEditPrompt('')
    }, [])

    const handleSubmitEdit = useCallback((task: ImageTask) => {
        if (!editPrompt.trim()) return
        onEdit(task, editPrompt)
        setEditingTaskId(null)
        setEditPrompt('')
    }, [editPrompt, onEdit])

    const handleStartRename = useCallback((task: ImageTask) => {
        setRenamingTaskId(task.id)
        setRenameValue(task.customName || task.prompt.slice(0, 30))
    }, [])

    const handleSubmitRename = useCallback((taskId: string) => {
        onRename(taskId, renameValue.trim())
        setRenamingTaskId(null)
    }, [renameValue, onRename])

    // Lightbox navigation
    const lightboxTasks = succeededTasks
    const lightboxTask = lightboxIndex !== null ? lightboxTasks[lightboxIndex] : null

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] text-[var(--glass-text-tertiary)] gap-3">
                <AppIcon name="image" className="w-16 h-16 opacity-20" />
                <span className="text-sm">{t('empty')}</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="glass-surface p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[var(--glass-text-secondary)]">{t('total', { count: tasks.length })}</span>
                        {runningCount > 0 && <span className="text-xs text-[var(--glass-tone-info-fg)] animate-pulse">({t('running', { count: runningCount })})</span>}
                        {completedCount > 0 && <span className="text-xs text-[var(--glass-tone-success-fg)]">({t('completed', { count: completedCount })})</span>}
                        {failedCount > 0 && <span className="text-xs text-[var(--glass-tone-danger-fg)]">({t('failed', { count: failedCount })})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        {failedCount > 0 && (
                            <button onClick={onRetryAll} className="glass-btn-base glass-btn-tone-warning flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium">
                                <AppIcon name="play" className="w-3 h-3" />
                                <span>{t('retryAll')}</span>
                            </button>
                        )}
                        <button
                            onClick={handleDownloadAll}
                            disabled={succeededTasks.length === 0 || isDownloadingAll}
                            className="glass-btn-base glass-btn-tone-info flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDownloadingAll ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>{downloadProgress ? t('downloadProgress', downloadProgress) : t('downloading')}</span>
                                </>
                            ) : (
                                <>
                                    <AppIcon name="download" className="w-3.5 h-3.5" />
                                    <span>{t('downloadAll')}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {tasks.map((task, idx) => {
                    const succeededIdx = task.status === 'succeeded' ? lightboxTasks.indexOf(task) : -1
                    return (
                        <div key={task.id} className="glass-surface border border-[var(--glass-stroke-base)] rounded-xl overflow-hidden group relative">
                            <div className="relative aspect-square bg-black/5">
                                {task.status === 'succeeded' && task.imageUrl ? (
                                    <img
                                        src={task.imageUrl}
                                        alt={task.prompt}
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => setLightboxIndex(succeededIdx)}
                                    />
                                ) : task.status === 'submitting' ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 border-2 border-[var(--glass-tone-info-fg)] border-t-transparent rounded-full animate-spin" />
                                            <span className="text-[10px] text-[var(--glass-text-tertiary)]">{t('status.submitting')}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-3">
                                        <AppIcon name="alert" className="w-8 h-8 text-[var(--glass-tone-danger-fg)]" />
                                        <span className="text-[10px] text-[var(--glass-tone-danger-fg)]">{t('status.failed')}</span>
                                        {task.error && <span className="text-[9px] text-[var(--glass-text-tertiary)] text-center line-clamp-2">{task.error}</span>}
                                        <button onClick={() => onRetry(task.id)} className="mt-1 px-3 py-1 text-[10px] rounded bg-[var(--glass-bg-muted)] hover:bg-[var(--glass-bg-surface-strong)] text-[var(--glass-text-secondary)] transition-colors">
                                            {t('retry')}
                                        </button>
                                    </div>
                                )}

                                {/* Hover actions */}
                                {task.status === 'succeeded' && task.imageUrl && (
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-center pb-2 gap-1.5 opacity-0 group-hover:opacity-100">
                                        <button onClick={() => handleStartEdit(task.id)} className="px-2 py-1 rounded bg-black/60 text-white text-[10px] font-medium hover:bg-black/80 transition-colors flex items-center gap-1">
                                            <AppIcon name="sparklesAlt" className="w-3 h-3" />
                                            {t('edit')}
                                        </button>
                                        <button onClick={() => onUseForVideo(task.imageUrl!)} className="px-2 py-1 rounded bg-black/60 text-white text-[10px] font-medium hover:bg-black/80 transition-colors flex items-center gap-1">
                                            <AppIcon name="film" className="w-3 h-3" />
                                            {t('useForVideo')}
                                        </button>
                                        <button onClick={() => handleDownloadOne(task.imageUrl!, task)} className="px-2 py-1 rounded bg-black/60 text-white text-[10px] font-medium hover:bg-black/80 transition-colors flex items-center gap-1">
                                            <AppIcon name="download" className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}

                                {/* Remove button */}
                                <button onClick={() => onRemove(task.id)} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all">
                                    <AppIcon name="closeMd" className="w-2.5 h-2.5" />
                                </button>
                            </div>

                            {/* Edit mode */}
                            {editingTaskId === task.id ? (
                                <div className="p-2 space-y-1.5">
                                    <input
                                        type="text"
                                        value={editPrompt}
                                        onChange={e => setEditPrompt(e.target.value)}
                                        placeholder={t('editPromptPlaceholder')}
                                        className="w-full px-2 py-1 text-xs rounded border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-primary)] focus:outline-none focus:border-[var(--glass-tone-info-fg)]"
                                        autoFocus
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmitEdit(task) }}
                                    />
                                    <div className="flex gap-1">
                                        <button onClick={() => handleSubmitEdit(task)} disabled={!editPrompt.trim()} className="flex-1 px-2 py-1 text-[10px] rounded bg-[var(--glass-tone-info-fg)] text-white font-medium disabled:opacity-50">{t('editSubmit')}</button>
                                        <button onClick={() => setEditingTaskId(null)} className="px-2 py-1 text-[10px] rounded border border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)]">{t('editCancel')}</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-2 group/name">
                                    {renamingTaskId === task.id ? (
                                        <input
                                            type="text"
                                            value={renameValue}
                                            onChange={e => setRenameValue(e.target.value)}
                                            className="w-full px-1.5 py-0.5 text-[11px] rounded border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-primary)] focus:outline-none focus:border-[var(--glass-tone-info-fg)]"
                                            autoFocus
                                            onBlur={() => handleSubmitRename(task.id)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmitRename(task.id)
                                                if (e.key === 'Escape') setRenamingTaskId(null)
                                            }}
                                        />
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <p className="text-[11px] text-[var(--glass-text-secondary)] line-clamp-1 flex-1">{task.customName || task.prompt}</p>
                                            <button
                                                onClick={() => handleStartRename(task)}
                                                className="opacity-0 group-hover/name:opacity-100 shrink-0 text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)] transition-all"
                                            >
                                                <AppIcon name="edit" className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Lightbox */}
            {lightboxTask && lightboxIndex !== null && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
                    <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <img src={lightboxTask.imageUrl} alt={lightboxTask.prompt} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
                        <button onClick={() => setLightboxIndex(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                            <AppIcon name="close" className="w-5 h-5" />
                        </button>
                        {lightboxIndex > 0 && (
                            <button onClick={() => setLightboxIndex(lightboxIndex - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                                <AppIcon name="chevronLeft" className="w-5 h-5" />
                            </button>
                        )}
                        {lightboxIndex < lightboxTasks.length - 1 && (
                            <button onClick={() => setLightboxIndex(lightboxIndex + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                                <AppIcon name="chevronRight" className="w-5 h-5" />
                            </button>
                        )}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full max-w-md truncate">
                            {lightboxTask.prompt}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
