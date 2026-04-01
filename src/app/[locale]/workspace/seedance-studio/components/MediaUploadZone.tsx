'use client'

import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'

interface MediaFile {
    id: string
    previewUrl: string
    uploading: boolean
    error?: string
}

interface MediaUploadZoneProps {
    label: string
    hint: string
    files: MediaFile[]
    maxFiles: number
    accept: string
    onTriggerPicker: () => void
    onRemove: (id: string) => void
    onDrop?: (files: FileList) => void
    previewType?: 'image' | 'video' | 'audio'
}

export default function MediaUploadZone({
    label,
    hint,
    files,
    maxFiles,
    onTriggerPicker,
    onRemove,
    onDrop,
    previewType = 'image',
}: MediaUploadZoneProps) {
    const t = useTranslations('seedanceStudio.reference')
    const canAdd = files.length < maxFiles

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (onDrop && e.dataTransfer.files.length > 0) {
            onDrop(e.dataTransfer.files)
        }
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--glass-text-secondary)]">{label}</span>
                <span className="text-[10px] text-[var(--glass-text-tertiary)]">{hint} ({files.length}/{maxFiles})</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {files.map(f => (
                    <div key={f.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--glass-stroke-base)] group">
                        {previewType === 'image' && (
                            <img src={f.previewUrl} alt="" className="w-full h-full object-cover" />
                        )}
                        {previewType === 'video' && (
                            <video src={f.previewUrl} className="w-full h-full object-cover" muted />
                        )}
                        {previewType === 'audio' && (
                            <div className="w-full h-full flex items-center justify-center bg-[var(--glass-bg-surface-strong)]">
                                <AppIcon name="audioWave" className="w-6 h-6 text-[var(--glass-text-tertiary)]" />
                            </div>
                        )}
                        {f.uploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                        {f.error && (
                            <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                                <AppIcon name="alert" className="w-4 h-4 text-white" />
                            </div>
                        )}
                        <button
                            onClick={() => onRemove(f.id)}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <AppIcon name="closeMd" className="w-2.5 h-2.5" />
                        </button>
                    </div>
                ))}
                {canAdd && (
                    <button
                        onClick={onTriggerPicker}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--glass-stroke-base)] flex flex-col items-center justify-center gap-0.5 text-[var(--glass-text-tertiary)] hover:border-[var(--glass-tone-info-fg)] hover:text-[var(--glass-tone-info-fg)] transition-colors"
                    >
                        <AppIcon name="plus" className="w-4 h-4" />
                        <span className="text-[8px]">{t('dropOrClick')}</span>
                    </button>
                )}
            </div>
        </div>
    )
}
