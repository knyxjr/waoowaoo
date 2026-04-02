'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'

interface Task {
    id: string
    taskId: string
    status: 'submitting' | 'processing' | 'succeeded' | 'failed'
    videoUrl?: string
    error?: string
    prompt: string
    customName?: string
    createdAt: number
}

interface ResultPanelProps {
    tasks: Task[]
    onRemove: (id: string) => void
    onRetry: (id: string) => void
    onRetryAll: () => void
    onRename: (id: string, name: string) => void
}

export default function ResultPanel({ tasks, onRemove, onRetry, onRetryAll, onRename }: ResultPanelProps) {
    const t = useTranslations('seedanceStudio.task')
    const [playingId, setPlayingId] = useState<string | null>(null)
    const [renamingTaskId, setRenamingTaskId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [isDownloadingAll, setIsDownloadingAll] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null)
    const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

    const runningCount = tasks.filter(t => t.status === 'submitting' || t.status === 'processing').length
    const completedCount = tasks.filter(t => t.status === 'succeeded').length
    const failedCount = tasks.filter(t => t.status === 'failed').length
    const videosWithUrl = tasks.filter(t => t.videoUrl).length

    const handlePlay = useCallback((taskId: string) => {
        if (playingId && playingId !== taskId) {
            const prevVideo = videoRefs.current.get(playingId)
            if (prevVideo) { prevVideo.pause(); prevVideo.currentTime = 0 }
        }
        setPlayingId(taskId)
    }, [playingId])

    const handleDownloadOne = useCallback(async (videoUrl: string, task: Task) => {
        try {
            const res = await fetch(videoUrl)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${task.customName || `seedance-${task.taskId.slice(0, 8)}`}.mp4`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch {
            window.open(videoUrl, '_blank')
        }
    }, [])

    const handleDownloadAll = useCallback(async () => {
        const videoTasks = tasks.filter(t => t.videoUrl)
        if (videoTasks.length === 0) return
        setIsDownloadingAll(true)
        setDownloadProgress({ current: 0, total: videoTasks.length })

        try {
            const JSZip = (await import('jszip')).default
            const zip = new JSZip()

            let failedDownloads = 0
            for (let i = 0; i < videoTasks.length; i++) {
                const task = videoTasks[i]
                setDownloadProgress({ current: i + 1, total: videoTasks.length })
                try {
                    const res = await fetch(task.videoUrl!)
                    if (!res.ok) { failedDownloads++; continue }
                    const blob = await res.blob()
                    const name = `${task.customName || `seedance-${task.taskId.slice(0, 8)}`}-${i + 1}.mp4`
                    zip.file(name, blob)
                } catch { failedDownloads++ }
            }

            if (failedDownloads === videoTasks.length) {
                alert(t('downloadAllFailed'))
                return
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' })
            const url = URL.createObjectURL(zipBlob)
            const a = document.createElement('a')
            a.href = url
            a.download = `creative-studio-videos.zip`
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
    }, [tasks])

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] text-[var(--glass-text-tertiary)] gap-3">
                <AppIcon name="video" className="w-16 h-16 opacity-20" />
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
                        <span className="text-sm font-semibold text-[var(--glass-text-secondary)]">
                            {t('title')}
                        </span>
                        <span className="text-xs text-[var(--glass-text-tertiary)]">
                            {t('total', { count: tasks.length })}
                            {runningCount > 0 && (
                                <span className="text-[var(--glass-tone-info-fg)] ml-2 animate-pulse">
                                    ({t('running', { count: runningCount })})
                                </span>
                            )}
                            {completedCount > 0 && (
                                <span className="text-[var(--glass-tone-success-fg)] ml-2">
                                    ({t('completed', { count: completedCount })})
                                </span>
                            )}
                            {failedCount > 0 && (
                                <span className="text-[var(--glass-tone-danger-fg)] ml-2">
                                    ({t('failed', { count: failedCount })})
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {failedCount > 0 && (
                            <button
                                onClick={onRetryAll}
                                className="glass-btn-base glass-btn-tone-warning flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                            >
                                <AppIcon name="play" className="w-3 h-3" />
                                <span>{t('retryAll')}</span>
                            </button>
                        )}
                        <button
                            onClick={handleDownloadAll}
                        disabled={videosWithUrl === 0 || isDownloadingAll}
                        className="glass-btn-base glass-btn-tone-info flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title={videosWithUrl === 0 ? t('noVideos') : ''}
                    >
                        {isDownloadingAll ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>
                                    {downloadProgress
                                        ? t('downloadProgress', downloadProgress)
                                        : t('downloading')}
                                </span>
                            </>
                        ) : (
                            <>
                                <AppIcon name="image" className="w-3.5 h-3.5" />
                                <span>{t('downloadAll')}</span>
                            </>
                        )}
                    </button>
                    </div>
                </div>
            </div>

            {/* Video Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        isPlaying={playingId === task.id}
                        onPlay={() => handlePlay(task.id)}
                        onStop={() => setPlayingId(null)}
                        onDownload={() => handleDownloadOne(task.videoUrl!, task)}
                        onRemove={() => onRemove(task.id)}
                        onRetry={() => onRetry(task.id)}
                        isRenaming={renamingTaskId === task.id}
                        renameValue={renameValue}
                        onStartRename={() => { setRenamingTaskId(task.id); setRenameValue(task.customName || task.prompt.slice(0, 30)) }}
                        onRenameChange={setRenameValue}
                        onSubmitRename={() => { onRename(task.id, renameValue.trim()); setRenamingTaskId(null) }}
                        onCancelRename={() => setRenamingTaskId(null)}
                        videoRefs={videoRefs}
                        t={t}
                    />
                ))}
            </div>
        </div>
    )
}

interface TaskCardProps {
    task: Task
    isPlaying: boolean
    onPlay: () => void
    onStop: () => void
    onDownload: () => void
    onRemove: () => void
    onRetry: () => void
    isRenaming: boolean
    renameValue: string
    onStartRename: () => void
    onRenameChange: (v: string) => void
    onSubmitRename: () => void
    onCancelRename: () => void
    videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>
    t: ReturnType<typeof useTranslations>
}

function TaskCard({ task, isPlaying, onPlay, onStop, onDownload, onRemove, onRetry, isRenaming, renameValue, onStartRename, onRenameChange, onSubmitRename, onCancelRename, videoRefs, t }: TaskCardProps) {
    const statusColor = {
        submitting: 'text-[var(--glass-tone-info-fg)]',
        processing: 'text-[var(--glass-tone-info-fg)]',
        succeeded: 'text-[var(--glass-tone-success-fg)]',
        failed: 'text-[var(--glass-tone-danger-fg)]',
    }[task.status]

    // Elapsed time for running tasks
    const [elapsed, setElapsed] = useState(0)
    const isRunning = task.status === 'submitting' || task.status === 'processing'
    useEffect(() => {
        if (!isRunning) return
        setElapsed(Math.floor((Date.now() - task.createdAt) / 1000))
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - task.createdAt) / 1000))
        }, 1000)
        return () => clearInterval(timer)
    }, [isRunning, task.createdAt])

    const formatElapsed = (sec: number) => {
        const m = Math.floor(sec / 60)
        const s = sec % 60
        return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
    }

    return (
        <div className="glass-surface border border-[var(--glass-stroke-base)] rounded-xl overflow-hidden group">
            {/* Video Preview Area */}
            <div className="relative bg-black aspect-video">
                {task.status === 'succeeded' && task.videoUrl ? (
                    isPlaying ? (
                        <video
                            ref={el => { if (el) videoRefs.current.set(task.id, el) }}
                            src={task.videoUrl}
                            controls
                            autoPlay
                            playsInline
                            className="w-full h-full object-contain"
                            onEnded={onStop}
                        />
                    ) : (
                        <div
                            className="w-full h-full flex items-center justify-center cursor-pointer group/play"
                            onClick={onPlay}
                        >
                            {/* Use first frame as thumbnail via video element */}
                            <video
                                src={task.videoUrl}
                                className="w-full h-full object-contain"
                                muted
                                preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/play:bg-black/40 transition-colors">
                                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover/play:scale-110 transition-transform">
                                    <AppIcon name="play" className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        {(task.status === 'submitting' || task.status === 'processing') && (
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-[var(--glass-tone-info-fg)] border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-white/60">
                                    {t(`status.${task.status}`)}
                                </span>
                                <span className="text-[10px] text-white/40 tabular-nums">
                                    {formatElapsed(elapsed)}
                                </span>
                            </div>
                        )}
                        {task.status === 'failed' && (
                            <div className="flex flex-col items-center gap-1.5 px-4">
                                <AppIcon name="alert" className="w-8 h-8 text-[var(--glass-tone-danger-fg)]" />
                                <span className="text-xs text-[var(--glass-tone-danger-fg)]">
                                    {t('status.failed')}
                                </span>
                                {task.error && (
                                    <span className="text-[10px] text-white/40 text-center line-clamp-2">
                                        {task.error}
                                    </span>
                                )}
                                <button
                                    onClick={onRetry}
                                    className="mt-1 px-3 py-1 text-[10px] rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
                                >
                                    {t('retry')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Status badge */}
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-medium bg-black/50 ${statusColor}`}>
                    {t(`status.${task.status}`)}
                    {isRunning && <span className="ml-1 tabular-nums">{formatElapsed(elapsed)}</span>}
                </div>

                {/* Remove button */}
                <button
                    onClick={onRemove}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white/70 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 hover:text-white transition-all"
                >
                    <AppIcon name="closeMd" className="w-3 h-3" />
                </button>

                {/* Download button overlay */}
                {task.status === 'succeeded' && task.videoUrl && !isPlaying && (
                    <button
                        onClick={e => { e.stopPropagation(); onDownload() }}
                        className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/50 text-white/80 text-[10px] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:bg-black/70 hover:text-white transition-all"
                    >
                        <AppIcon name="image" className="w-3 h-3" />
                        {t('download')}
                    </button>
                )}
            </div>

            {/* Prompt text */}
            <div className="p-2.5 group/name">
                {isRenaming ? (
                    <input
                        type="text"
                        value={renameValue}
                        onChange={e => onRenameChange(e.target.value)}
                        className="w-full px-1.5 py-0.5 text-xs rounded border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-primary)] focus:outline-none focus:border-[var(--glass-tone-info-fg)]"
                        autoFocus
                        onBlur={onSubmitRename}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSubmitRename()
                            if (e.key === 'Escape') onCancelRename()
                        }}
                    />
                ) : (
                    <div className="flex items-center gap-1">
                        <p className="text-xs text-[var(--glass-text-secondary)] line-clamp-2 flex-1">
                            {task.customName || task.prompt || '...'}
                        </p>
                        <button
                            onClick={onStartRename}
                            className="opacity-0 group-hover/name:opacity-100 shrink-0 text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)] transition-all"
                        >
                            <AppIcon name="edit" className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
