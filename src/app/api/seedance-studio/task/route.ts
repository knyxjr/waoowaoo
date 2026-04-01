import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { arkQueryVideoTask } from '@/lib/ark-api'
import { getProviderConfig } from '@/lib/api-config'
import { logInfo as _ulogInfo } from '@/lib/logging/core'

export const GET = apiHandler(async (request: NextRequest) => {
    const session = await requireAuth()
    const taskId = request.nextUrl.searchParams.get('taskId')

    if (!taskId) {
        throw new ApiError('INVALID_PARAMS')
    }

    const { apiKey } = await getProviderConfig(session.user.id, 'ark')

    const result = await arkQueryVideoTask(taskId, {
        apiKey,
        logPrefix: '[Seedance Studio]',
    })

    const raw = result as unknown as Record<string, unknown>

    // Normalize status: Ark returns "running" for in-progress tasks
    const arkStatus = String(raw.status || '')
    let status: 'processing' | 'succeeded' | 'failed'
    if (arkStatus === 'succeeded') {
        status = 'succeeded'
    } else if (arkStatus === 'failed') {
        status = 'failed'
    } else {
        status = 'processing'
    }

    // Extract video URL from multiple possible response shapes:
    // 1. Object: { video_url: "https://..." }
    // 2. Object: { video_url: { url: "https://..." } }
    // 3. Array:  [{ video_url: { url: "https://..." } }]
    let videoUrl: string | undefined
    const content = raw.content
    if (content && typeof content === 'object' && !Array.isArray(content)) {
        const obj = content as Record<string, unknown>
        if (typeof obj.video_url === 'string') {
            videoUrl = obj.video_url
        } else if (obj.video_url && typeof (obj.video_url as Record<string, unknown>).url === 'string') {
            videoUrl = (obj.video_url as Record<string, unknown>).url as string
        }
    } else if (Array.isArray(content) && content.length > 0) {
        const first = content[0] as Record<string, unknown>
        if (typeof first?.video_url === 'string') {
            videoUrl = first.video_url
        } else if (first?.video_url && typeof (first.video_url as Record<string, unknown>).url === 'string') {
            videoUrl = (first.video_url as Record<string, unknown>).url as string
        }
    }

    _ulogInfo(`[Seedance Studio] Task ${taskId}: arkStatus=${arkStatus}, normalizedStatus=${status}, videoUrl=${videoUrl ? videoUrl.slice(0, 80) : 'none'}, contentLength=${Array.isArray(content) ? content.length : 'N/A'}, rawKeys=${Object.keys(raw).join(',')}`)

    // If succeeded, log full response for debugging
    if (status === 'succeeded') {
        _ulogInfo(`[Seedance Studio] Task ${taskId} SUCCEEDED full response: ${JSON.stringify(raw).slice(0, 2000)}`)
    }

    return NextResponse.json({
        id: raw.id,
        status,
        videoUrl,
        content: raw.content,
        error: raw.error,
    })
})
