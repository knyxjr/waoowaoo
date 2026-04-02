'use client'

import { useTranslations } from 'next-intl'

interface PromptInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export default function PromptInput({ value, onChange, placeholder }: PromptInputProps) {
    const t = useTranslations('seedanceStudio.prompt')

    return (
        <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--glass-text-secondary)]">{t('label')}</label>
            <textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder || t('placeholder')}
                rows={3}
                className="w-full rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-2 text-sm text-[var(--glass-text-primary)] placeholder:text-[var(--glass-text-tertiary)] focus:border-[var(--glass-tone-info-fg)] focus:outline-none resize-none"
            />
        </div>
    )
}
