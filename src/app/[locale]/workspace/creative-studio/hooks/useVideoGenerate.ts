'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { sessionStorageKey } from './useStudioSessions'

const FRIENDLY_ERRORS: Record<string, string> = {
    'InputImageSensitiveContentDetected.PrivacyInformation': '输入图片包含真人面部，请更换图片',
    'InputImageSensitiveContentDetected': '输入图片内容审核未通过',
    'OutputVideoSensitiveContentDetected': '生成视频内容审核未通过',
    'SENSITIVE_CONTENT': '内容审核未通过',
    'INVALID_PARAMS': '参数错误',
}

function extractErrorMessage(data: Record<string, unknown>, status: number): string {
    const errObj = (data.error && typeof data.error === 'object' ? data.error : data) as Record<string, unknown>
    const code = (errObj.code as string) || ''
    const message = (errObj.message as string) || ''

    for (const [key, friendly] of Object.entries(FRIENDLY_ERRORS)) {
        if (code.includes(key) || message.includes(key)) return friendly
    }

    const arkMatch = message.match(/"code"\s*:\s*"([^"]+)"/)
    if (arkMatch) {
        for (const [key, friendly] of Object.entries(FRIENDLY_ERRORS)) {
            if (arkMatch[1].includes(key)) return friendly
        }
        return arkMatch[1]
    }

    if (message && message.length < 200) return message
    return `请求失败 (${status})`
}

export interface VideoGenerateParams {
    model: string
    prompt: string
    content: Array<Record<string, unknown>>
    resolution?: string
    ratio?: string
    duration?: number
    generateAudio?: boolean
    seed?: number
    tools?: Array<{ type: 'web_search' }>
}

export interface VideoTask {
    id: string
    taskId: string
    status: 'submitting' | 'processing' | 'succeeded' | 'failed'
    videoUrl?: string
    error?: string
    prompt: string
    customName?: string
    params?: VideoGenerateParams
    createdAt: number
}

function loadTasks(storageKey: string): VideoTask[] {
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return []
        const parsed = JSON.parse(raw) as VideoTask[]
        return parsed
            .map(t => t.status === 'submitting' ? { ...t, status: 'failed' as const, error: '页面刷新，提交中断' } : t)
            .sort((a, b) => b.createdAt - a.createdAt)
    } catch { return [] }
}

export function useVideoGenerate(sessionId: string) {
    const storageKey = sessionStorageKey(sessionId, 'video-tasks')
    const [tasks, setTasks] = useState<VideoTask[]>(() => loadTasks(storageKey))
    const pollingRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        setTasks(loadTasks(storageKey))
    }, [storageKey])

    useEffect(() => {
        try { localStorage.setItem(storageKey, JSON.stringify(tasks)) } catch { /* quota */ }
    }, [tasks, storageKey])

    const pollTask = useCallback(async (id: string, taskId: string) => {
        if (pollingRef.current.has(taskId)) return
        pollingRef.current.add(taskId)
        let consecutiveErrors = 0
        try {
            while (true) {
                await new Promise(r => setTimeout(r, 5000))
                try {
                    const res = await apiFetch(`/api/seedance-studio/task?taskId=${taskId}`)
                    if (res.status === 404) {
                        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'failed', error: '任务已过期或不存在' } : t))
                        return
                    }
                    if (!res.ok) { consecutiveErrors++; if (consecutiveErrors > 20) break; continue }
                    consecutiveErrors = 0
                    const data = await res.json()
                    if (data.status === 'succeeded') {
                        const c = data.content
                        const videoUrl = data.videoUrl
                            || (Array.isArray(c) ? c[0]?.video_url?.url ?? c[0]?.video_url : null)
                            || (c && typeof c === 'object' && !Array.isArray(c) ? (typeof c.video_url === 'string' ? c.video_url : c.video_url?.url) : null)
                        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'succeeded', videoUrl } : t))
                        return
                    }
                    if (data.status === 'failed') {
                        const errMsg = data.error?.message || data.error?.code || '生成失败'
                        const friendlyMsg = FRIENDLY_ERRORS[data.error?.code] || errMsg
                        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'failed', error: friendlyMsg } : t))
                        return
                    }
                } catch {
                    consecutiveErrors++
                    if (consecutiveErrors > 20) break
                }
            }
            setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'failed', error: '网络连续异常，轮询中止' } : t))
        } finally { pollingRef.current.delete(taskId) }
    }, [])

    useEffect(() => {
        const pending = tasks.filter(t => t.status === 'processing' && t.taskId)
        for (const t of pending) pollTask(t.id, t.taskId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const generate = useCallback(async (params: VideoGenerateParams) => {
        const tempId = crypto.randomUUID()
        const task: VideoTask = { id: tempId, taskId: '', status: 'submitting', prompt: params.prompt, params, createdAt: Date.now() }
        setTasks(prev => [task, ...prev])
        try {
            const res = await apiFetch('/api/seedance-studio/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(extractErrorMessage(data, res.status))
            }
            const data = await res.json()
            setTasks(prev => prev.map(t => t.id === tempId ? { ...t, taskId: data.taskId, status: 'processing' } : t))
            pollTask(tempId, data.taskId)
        } catch (err) {
            setTasks(prev => prev.map(t => t.id === tempId ? { ...t, status: 'failed', error: String(err) } : t))
        }
    }, [pollTask])

    const retryTask = useCallback(async (id: string) => {
        const task = tasks.find(t => t.id === id)
        if (!task) return
        if (task.taskId) {
            setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'processing' as const, error: undefined } : t))
            pollTask(id, task.taskId)
        } else if (task.params) {
            setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'submitting' as const, error: undefined } : t))
            try {
                const res = await apiFetch('/api/seedance-studio/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task.params),
                })
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(extractErrorMessage(data, res.status))
                }
                const data = await res.json()
                setTasks(prev => prev.map(t => t.id === id ? { ...t, taskId: data.taskId, status: 'processing' as const } : t))
                pollTask(id, data.taskId)
            } catch (err) {
                setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'failed' as const, error: String(err) } : t))
            }
        }
    }, [tasks, pollTask])

    const retryAllFailed = useCallback(() => {
        const failed = tasks.filter(t => t.status === 'failed')
        for (const t of failed) retryTask(t.id)
    }, [tasks, retryTask])

    const removeTask = useCallback((id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id))
    }, [])

    const renameTask = useCallback((id: string, name: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, customName: name } : t))
    }, [])

    return { tasks, generate, removeTask, retryTask, retryAllFailed, renameTask }
}
