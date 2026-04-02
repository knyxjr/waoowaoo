'use client'

import { useTranslations } from 'next-intl'

const RATIOS = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9', 'adaptive']
const RESOLUTIONS = ['480p', '720p']

const DURATIONS = [-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

interface VideoParamsSectionProps {
    resolution: string
    ratio: string
    duration: number
    generateAudio: boolean
    webSearch: boolean
    seed: string
    onResolutionChange: (v: string) => void
    onRatioChange: (v: string) => void
    onDurationChange: (v: number) => void
    onGenerateAudioChange: (v: boolean) => void
    onWebSearchChange: (v: boolean) => void
    onSeedChange: (v: string) => void
}

export default function VideoParamsSection({
    resolution, ratio, duration, generateAudio, webSearch, seed,
    onResolutionChange, onRatioChange, onDurationChange,
    onGenerateAudioChange, onWebSearchChange, onSeedChange,
}: VideoParamsSectionProps) {
    const t = useTranslations('seedanceStudio.params')

    return (
        <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[var(--glass-text-primary)]">{t('title')}</h3>

            {/* Resolution */}
            <div className="space-y-1">
                <label className="text-[10px] text-[var(--glass-text-secondary)]">{t('resolution')}</label>
                <div className="flex gap-1.5">
                    {RESOLUTIONS.map(r => (
                        <button
                            key={r}
                            onClick={() => onResolutionChange(r)}
                            className={`px-2.5 py-1 rounded-md text-[10px] transition-all ${
                                resolution === r
                                    ? 'glass-surface-modal border border-[var(--glass-tone-info-fg)] text-[var(--glass-tone-info-fg)]'
                                    : 'glass-surface border border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)]'
                            }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ratio */}
            <div className="space-y-1">
                <label className="text-[10px] text-[var(--glass-text-secondary)]">{t('ratio')}</label>
                <div className="flex flex-wrap gap-1.5">
                    {RATIOS.map(r => (
                        <button
                            key={r}
                            onClick={() => onRatioChange(r)}
                            className={`px-2.5 py-1 rounded-md text-[10px] transition-all ${
                                ratio === r
                                    ? 'glass-surface-modal border border-[var(--glass-tone-info-fg)] text-[var(--glass-tone-info-fg)]'
                                    : 'glass-surface border border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)]'
                            }`}
                        >
                            {r === 'adaptive' ? t('ratioAdaptive') : r}
                        </button>
                    ))}
                </div>
            </div>

            {/* Duration */}
            <div className="space-y-1">
                <label className="text-[10px] text-[var(--glass-text-secondary)]">{t('duration')}</label>
                <div className="flex flex-wrap gap-1.5">
                    {DURATIONS.map(d => (
                        <button
                            key={d}
                            onClick={() => onDurationChange(d)}
                            className={`px-2.5 py-1 rounded-md text-[10px] transition-all ${
                                duration === d
                                    ? 'glass-surface-modal border border-[var(--glass-tone-info-fg)] text-[var(--glass-tone-info-fg)]'
                                    : 'glass-surface border border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)]'
                            }`}
                        >
                            {d === -1 ? t('durationAuto') : `${d}s`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={generateAudio}
                        onChange={e => onGenerateAudioChange(e.target.checked)}
                        className="accent-[var(--glass-tone-info-fg)]"
                    />
                    <span className="text-[10px] text-[var(--glass-text-secondary)]">{t('generateAudio')}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={webSearch}
                        onChange={e => onWebSearchChange(e.target.checked)}
                        className="accent-[var(--glass-tone-info-fg)]"
                    />
                    <span className="text-[10px] text-[var(--glass-text-secondary)]">{t('webSearch')}</span>
                </label>
            </div>

            {/* Seed */}
            <div className="space-y-1">
                <label className="text-[10px] text-[var(--glass-text-secondary)]">{t('seed')}</label>
                <input
                    type="text"
                    value={seed}
                    onChange={e => onSeedChange(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('seedPlaceholder')}
                    className="w-full rounded-md border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-2 py-1 text-xs text-[var(--glass-text-primary)] placeholder:text-[var(--glass-text-tertiary)] focus:border-[var(--glass-tone-info-fg)] focus:outline-none"
                />
            </div>
        </div>
    )
}
