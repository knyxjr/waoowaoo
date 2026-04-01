'use client'

import { useTranslations } from 'next-intl'

interface ModelSelectorProps {
    value: string
    onChange: (model: string) => void
}

const MODELS = [
    { id: 'doubao-seedance-2-0-260128', labelKey: 'seedance2' as const },
    { id: 'doubao-seedance-2-0-fast-260128', labelKey: 'seedance2Fast' as const },
]

export default function ModelSelector({ value, onChange }: ModelSelectorProps) {
    const t = useTranslations('seedanceStudio.model')

    return (
        <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--glass-text-secondary)]">{t('label')}</label>
            <div className="flex gap-2">
                {MODELS.map(m => (
                    <button
                        key={m.id}
                        onClick={() => onChange(m.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                            value === m.id
                                ? 'glass-surface-modal border border-[var(--glass-tone-info-fg)] text-[var(--glass-tone-info-fg)] font-medium'
                                : 'glass-surface border border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-stroke-hover)]'
                        }`}
                    >
                        {t(m.labelKey)}
                    </button>
                ))}
            </div>
        </div>
    )
}
