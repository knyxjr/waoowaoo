'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { AppIcon } from '@/components/ui/icons'
import type { StudioSession } from '../hooks/useStudioSessions'

interface SessionSwitcherProps {
    sessions: StudioSession[]
    activeId: string
    onSwitch: (id: string) => void
    onCreate: (name?: string) => void
    onRename: (id: string, name: string) => void
    onDelete: (id: string) => void
}

export default function SessionSwitcher({ sessions, activeId, onSwitch, onCreate, onRename, onDelete }: SessionSwitcherProps) {
    const [open, setOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const dropRef = useRef<HTMLDivElement>(null)

    const active = sessions.find(s => s.id === activeId)

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const startRename = (s: StudioSession) => {
        setEditingId(s.id)
        setEditName(s.name)
    }

    const submitRename = () => {
        if (editingId && editName.trim()) {
            onRename(editingId, editName.trim())
        }
        setEditingId(null)
    }

    const onEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitRename()
        if (e.key === 'Escape') setEditingId(null)
    }

    return (
        <div className="relative" ref={dropRef}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-sm text-[var(--glass-text-primary)] hover:border-[var(--glass-stroke-hover)] transition-colors"
            >
                <AppIcon name="layers" className="w-4 h-4 text-[var(--glass-text-tertiary)]" />
                <span className="max-w-[120px] truncate">{active?.name || '会话'}</span>
                <AppIcon name="chevronDown" className="w-3 h-3 text-[var(--glass-text-tertiary)]" />
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-1 w-64 z-50 glass-surface-modal border border-[var(--glass-stroke-base)] rounded-xl shadow-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                        {sessions.map(s => (
                            <div
                                key={s.id}
                                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${
                                    s.id === activeId
                                        ? 'bg-[var(--glass-tone-info-fg)]/10 text-[var(--glass-tone-info-fg)]'
                                        : 'hover:bg-[var(--glass-bg-muted)] text-[var(--glass-text-primary)]'
                                }`}
                                onClick={() => { onSwitch(s.id); setOpen(false) }}
                            >
                                {editingId === s.id ? (
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        onBlur={submitRename}
                                        onKeyDown={onEditKeyDown}
                                        onClick={e => e.stopPropagation()}
                                        className="flex-1 px-1.5 py-0.5 text-xs rounded border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-primary)] focus:outline-none"
                                        autoFocus
                                    />
                                ) : (
                                    <>
                                        <span className="flex-1 text-xs truncate">{s.name}</span>
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={e => { e.stopPropagation(); startRename(s) }}
                                                className="p-1 rounded hover:bg-[var(--glass-bg-surface-strong)] text-[var(--glass-text-tertiary)]"
                                            >
                                                <AppIcon name="edit" className="w-3 h-3" />
                                            </button>
                                            {sessions.length > 1 && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                                                    className="p-1 rounded hover:bg-[var(--glass-bg-surface-strong)] text-[var(--glass-tone-danger-fg)]"
                                                >
                                                    <AppIcon name="closeMd" className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-[var(--glass-stroke-base)]">
                        <button
                            onClick={() => { onCreate(); setOpen(false) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--glass-tone-info-fg)] hover:bg-[var(--glass-bg-muted)] transition-colors"
                        >
                            <AppIcon name="plus" className="w-3.5 h-3.5" />
                            新建会话
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
