import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { arkCreateVideoTask } from '@/lib/ark-api'
import { getProviderConfig } from '@/lib/api-config'
import { getObjectBuffer } from '@/lib/storage'
import { normalizeToBase64ForGeneration } from '@/lib/media/outbound-image'

function bufferToDataUrl(buffer: Buffer, key: string): string {
    const ext = key.split('.').pop()?.toLowerCase() || ''
    const mimeMap: Record<string, string> = {
        mp4: 'video/mp4', mov: 'video/quicktime',
        mp3: 'audio/mpeg', wav: 'audio/wav',
    }
    const mime = mimeMap[ext] || 'application/octet-stream'
    return `data:${mime};base64,${buffer.toString('base64')}`
}

async function resolveContentUrls(content: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
    const results: Array<Record<string, unknown>> = []
    for (const item of content) {
        const type = item.type as string
        if (type === 'image_url' && item.image_url) {
            const url = (item.image_url as { url: string }).url
            if (!url.startsWith('http') && !url.startsWith('data:')) {
                const base64Url = await normalizeToBase64ForGeneration(url)
                results.push({ ...item, image_url: { url: base64Url } })
            } else {
                results.push(item)
            }
        } else if (type === 'video_url' && item.video_url) {
            const url = (item.video_url as { url: string }).url
            if (!url.startsWith('http') && !url.startsWith('data:')) {
                const buffer = await getObjectBuffer(url)
                const dataUrl = bufferToDataUrl(buffer, url)
                results.push({ ...item, video_url: { url: dataUrl } })
            } else {
                results.push(item)
            }
        } else if (type === 'audio_url' && item.audio_url) {
            const url = (item.audio_url as { url: string }).url
            if (!url.startsWith('http') && !url.startsWith('data:')) {
                const buffer = await getObjectBuffer(url)
                const dataUrl = bufferToDataUrl(buffer, url)
                results.push({ ...item, audio_url: { url: dataUrl } })
            } else {
                results.push(item)
            }
        } else {
            results.push(item)
        }
    }
    return results
}

export const POST = apiHandler(async (request: NextRequest) => {
    const session = await requireAuth()

    const body = await request.json()
    const {
        model,
        prompt,
        content,
        resolution,
        ratio,
        duration,
        generateAudio,
        tools,
        seed,
    } = body

    if (!model) {
        throw new ApiError('INVALID_PARAMS')
    }
    if (!content || !Array.isArray(content) || content.length === 0) {
        if (!prompt?.trim()) {
            throw new ApiError('INVALID_PARAMS')
        }
    }

    const { apiKey } = await getProviderConfig(session.user.id, 'ark')

    const requestContent = await resolveContentUrls(content ?? []) as Parameters<typeof arkCreateVideoTask>[0]['content']
    if (prompt?.trim()) {
        requestContent.unshift({ type: 'text', text: prompt })
    }

    const taskRequest: Parameters<typeof arkCreateVideoTask>[0] = {
        model,
        content: requestContent,
    }
    if (resolution) taskRequest.resolution = resolution
    if (ratio) taskRequest.ratio = ratio
    if (typeof duration === 'number') taskRequest.duration = duration
    if (typeof generateAudio === 'boolean') taskRequest.generate_audio = generateAudio
    if (typeof seed === 'number') taskRequest.seed = seed
    if (tools && Array.isArray(tools)) taskRequest.tools = tools

    const result = await arkCreateVideoTask(taskRequest, {
        apiKey,
        logPrefix: '[Seedance Studio]',
    })

    return NextResponse.json({
        taskId: result.id,
    })
})
