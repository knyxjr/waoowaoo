'use client'

import { useState, useCallback, useMemo } from 'react'

const SESSIONS_KEY = 'creative-studio-sessions'
const ACTIVE_KEY = 'creative-studio-active-session'

export interface StudioSession {
    id: string
    name: string
    createdAt: number
    updatedAt: number
}

function generateId(): string {
    return crypto.randomUUID().slice(0, 8)
}

function createDefaultSession(): StudioSession {
    return { id: generateId(), name: '会话 1', createdAt: Date.now(), updatedAt: Date.now() }
}

function loadSessions(): StudioSession[] {
    try {
        const raw = localStorage.getItem(SESSIONS_KEY)
        if (!raw) return []
        return JSON.parse(raw) as StudioSession[]
    } catch { return [] }
}

function saveSessions(sessions: StudioSession[]) {
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)) } catch { /* quota */ }
}

function loadActiveId(): string | null {
    try { return localStorage.getItem(ACTIVE_KEY) } catch { return null }
}

function saveActiveId(id: string) {
    try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* quota */ }
}

export function useStudioSessions() {
    const [sessions, setSessions] = useState<StudioSession[]>(() => {
        const loaded = loadSessions()
        if (loaded.length > 0) return loaded
        const def = createDefaultSession()
        saveSessions([def])
        saveActiveId(def.id)
        return [def]
    })

    const [activeId, setActiveId] = useState<string>(() => {
        const saved = loadActiveId()
        if (saved && sessions.some(s => s.id === saved)) return saved
        return sessions[0].id
    })

    const activeSession = useMemo(
        () => sessions.find(s => s.id === activeId) ?? sessions[0],
        [sessions, activeId],
    )

    const switchSession = useCallback((id: string) => {
        setActiveId(id)
        saveActiveId(id)
    }, [])

    const createSession = useCallback((name?: string) => {
        const newSession: StudioSession = {
            id: generateId(),
            name: name || `会话 ${sessions.length + 1}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }
        const next = [...sessions, newSession]
        setSessions(next)
        saveSessions(next)
        setActiveId(newSession.id)
        saveActiveId(newSession.id)
        return newSession
    }, [sessions])

    const renameSession = useCallback((id: string, name: string) => {
        const next = sessions.map(s => s.id === id ? { ...s, name, updatedAt: Date.now() } : s)
        setSessions(next)
        saveSessions(next)
    }, [sessions])

    const deleteSession = useCallback((id: string) => {
        if (sessions.length <= 1) return
        const next = sessions.filter(s => s.id !== id)
        setSessions(next)
        saveSessions(next)
        if (activeId === id) {
            const fallback = next[0].id
            setActiveId(fallback)
            saveActiveId(fallback)
        }
        // Clean up session data
        const prefixes = [
            `creative-studio-${id}-image-tasks`,
            `creative-studio-${id}-video-tasks`,
            `creative-studio-${id}-chat-messages`,
            `creative-studio-${id}-system-prompt`,
        ]
        for (const key of prefixes) {
            try { localStorage.removeItem(key) } catch { /* ignore */ }
        }
    }, [sessions, activeId])

    return {
        sessions,
        activeSession,
        activeId,
        switchSession,
        createSession,
        renameSession,
        deleteSession,
    }
}

/** Build a session-scoped storage key */
export function sessionStorageKey(sessionId: string, suffix: string): string {
    return `creative-studio-${sessionId}-${suffix}`
}
