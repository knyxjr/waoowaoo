'use client'

import { useState, useCallback, useRef } from 'react'
import { apiFetch } from '@/lib/api-fetch'

interface MediaFile {
    id: string
    file: File
    previewUrl: string
    cosKey?: string
    uploading: boolean
    error?: string
}

interface UseMediaUploadOptions {
    maxFiles: number
    accept: string
    maxSizeMB?: number
}

export function useMediaUpload({ maxFiles, accept, maxSizeMB = 50 }: UseMediaUploadOptions) {
    const [files, setFiles] = useState<MediaFile[]>([])
    const inputRef = useRef<HTMLInputElement | null>(null)

    const upload = useCallback(async (file: File): Promise<string | null> => {
        const isImage = file.type.startsWith('image/')
        const isLargeFile = file.size > 5 * 1024 * 1024 // > 5MB use FormData

        let res: Response
        if (!isImage || isLargeFile) {
            // FormData for video/audio/large files
            const formData = new FormData()
            formData.append('file', file)
            res = await apiFetch('/api/asset-hub/upload-temp', {
                method: 'POST',
                body: formData,
            })
        } else {
            // Base64 for small images
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(file)
            })
            res = await apiFetch('/api/asset-hub/upload-temp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64, filename: file.name }),
            })
        }

        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        return data.key ?? null
    }, [])

    const addFiles = useCallback(async (newFiles: FileList | File[]) => {
        const arr = Array.from(newFiles)
        const remaining = maxFiles - files.length
        const toAdd = arr.slice(0, remaining)

        const entries: MediaFile[] = toAdd.map(f => ({
            id: crypto.randomUUID(),
            file: f,
            previewUrl: URL.createObjectURL(f),
            uploading: true,
        }))

        setFiles(prev => [...prev, ...entries])

        for (const entry of entries) {
            if (maxSizeMB && entry.file.size > maxSizeMB * 1024 * 1024) {
                setFiles(prev => prev.map(f =>
                    f.id === entry.id ? { ...f, uploading: false, error: `Max ${maxSizeMB}MB` } : f
                ))
                continue
            }
            try {
                const key = await upload(entry.file)
                setFiles(prev => prev.map(f =>
                    f.id === entry.id ? { ...f, uploading: false, cosKey: key ?? undefined } : f
                ))
            } catch (err) {
                setFiles(prev => prev.map(f =>
                    f.id === entry.id ? { ...f, uploading: false, error: String(err) } : f
                ))
            }
        }
    }, [files.length, maxFiles, maxSizeMB, upload])

    const removeFile = useCallback((id: string) => {
        setFiles(prev => {
            const f = prev.find(x => x.id === id)
            if (f) URL.revokeObjectURL(f.previewUrl)
            return prev.filter(x => x.id !== id)
        })
    }, [])

    const triggerPicker = useCallback(() => {
        if (!inputRef.current) {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = accept
            input.multiple = maxFiles > 1
            input.style.display = 'none'
            document.body.appendChild(input)
            inputRef.current = input
            input.addEventListener('change', () => {
                if (input.files) addFiles(input.files)
                input.value = ''
            })
        }
        inputRef.current.click()
    }, [accept, addFiles, maxFiles])

    const clear = useCallback(() => {
        files.forEach(f => URL.revokeObjectURL(f.previewUrl))
        setFiles([])
    }, [files])

    const addFromUrl = useCallback(async (url: string, filename: string) => {
        const remaining = maxFiles - files.length
        if (remaining <= 0) return
        const id = crypto.randomUUID()
        try {
            const res = await fetch(url)
            const blob = await res.blob()
            const file = new File([blob], filename, { type: blob.type || 'image/png' })
            const previewUrl = URL.createObjectURL(blob)
            setFiles(prev => [...prev, { id, file, previewUrl, uploading: true }])
            const key = await upload(file)
            setFiles(prev => prev.map(f =>
                f.id === id ? { ...f, uploading: false, cosKey: key ?? undefined } : f
            ))
        } catch (err) {
            setFiles(prev => prev.map(f =>
                f.id === id ? { ...f, uploading: false, error: String(err) } : f
            ))
        }
    }, [files.length, maxFiles, upload])

    const readyKeys = files.filter(f => f.cosKey && !f.error).map(f => f.cosKey!)
    const isUploading = files.some(f => f.uploading)

    return { files, addFiles, removeFile, triggerPicker, clear, addFromUrl, readyKeys, isUploading }
}
