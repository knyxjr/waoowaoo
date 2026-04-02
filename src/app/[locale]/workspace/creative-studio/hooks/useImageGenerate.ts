'use client'

import { useState, useCallback, useEffect } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { sessionStorageKey } from './useStudioSessions'

interface ImageGenerateParams {
    modelKey: string
    prompt: string
    artStyle?: string
    customArtStylePrompt?: string
    aspectRatio?: string
    imageSize?: string
    referenceImages?: string[]
}

export interface ImageTask {
    id: string
    status: 'submitting' | 'succeeded' | 'failed'
    imageUrl?: string
    cosKey?: string
    error?: string
    prompt: string
    customName?: string
    params?: ImageGenerateParams
    createdAt: number
}

function loadTasks(storageKey: string): ImageTask[] {
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return []
        const parsed = JSON.parse(raw) as ImageTask[]
        return parsed
            .map(t => t.status === 'submitting' ? { ...t, status: 'failed' as const, error: '页面刷新，生成中断' } : t)
            .sort((a, b) => b.createdAt - a.createdAt)
    } catch { return [] }
}

function extractErrorMessage(data: Record<string, unknown>, status: number): string {
    const err = data.error
    if (typeof err === 'string') return err
    if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
        return (err as { message: string }).message
    }
    return data.message as string || `请求失败 (${status})`
}

export function useImageGenerate(sessionId: string) {
    const storageKey = sessionStorageKey(sessionId, 'image-tasks')
    const [tasks, setTasks] = useState<ImageTask[]>(() => loadTasks(storageKey))

    // Reload when sessionId changes
    useEffect(() => {
        setTasks(loadTasks(storageKey))
    }, [storageKey])

    useEffect(() => {
        try { localStorage.setItem(storageKey, JSON.stringify(tasks)) } catch { /* quota */ }
    }, [tasks, storageKey])

    const generate = useCallback(async (params: ImageGenerateParams) => {
        const tempId = crypto.randomUUID()
        const task: ImageTask = {
            id: tempId,
            status: 'submitting',
            prompt: params.prompt,
            params,
            createdAt: Date.now(),
        }
        setTasks(prev => [task, ...prev])

        try {
            const res = await apiFetch('/api/creative-studio/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(extractErrorMessage(data, res.status))
            }
            setTasks(prev => prev.map(t =>
                t.id === tempId ? { ...t, status: 'succeeded', imageUrl: data.imageUrl, cosKey: data.cosKey } : t
            ))
        } catch (err) {
            setTasks(prev => prev.map(t =>
                t.id === tempId ? { ...t, status: 'failed', error: err instanceof Error ? err.message : String(err) } : t
            ))
        }
    }, [])

    const retryTask = useCallback(async (id: string) => {
        const task = tasks.find(t => t.id === id)
        if (!task?.params) return
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'submitting' as const, error: undefined } : t))
        try {
            const res = await apiFetch('/api/creative-studio/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task.params),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(extractErrorMessage(data, res.status))
            }
            setTasks(prev => prev.map(t =>
                t.id === id ? { ...t, status: 'succeeded', imageUrl: data.imageUrl, cosKey: data.cosKey } : t
            ))
        } catch (err) {
            setTasks(prev => prev.map(t =>
                t.id === id ? { ...t, status: 'failed', error: err instanceof Error ? err.message : String(err) } : t
            ))
        }
    }, [tasks])

    const retryAllFailed = useCallback(() => {
        const failed = tasks.filter(t => t.status === 'failed')
        for (const t of failed) { retryTask(t.id) }
    }, [tasks, retryTask])

    const removeTask = useCallback((id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id))
    }, [])

    const renameTask = useCallback((id: string, name: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, customName: name } : t))
    }, [])

    return { tasks, generate, removeTask, retryTask, retryAllFailed, renameTask }
}
