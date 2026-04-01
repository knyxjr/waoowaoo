import { NextRequest, NextResponse } from 'next/server'
import { getSignedUrl, uploadObject } from '@/lib/storage'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

/**
 * POST /api/asset-hub/upload-temp
 * 上传临时文件，返回签名 URL
 * 支持三种模式：
 * 1. 图片 Base64：{ imageBase64: "data:image/..." }
 * 2. 通用 Base64：{ base64: "...", extension: "wav" }
 * 3. FormData：file 字段（支持大文件如视频）
 */
export const POST = apiHandler(async (request: NextRequest) => {
    // 🔐 统一权限验证
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const contentType = request.headers.get('content-type') || ''

    let buffer: Buffer
    let ext: string
    let originalName = ''

    if (contentType.includes('multipart/form-data')) {
        // FormData 模式（视频/大文件）
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        if (!file) {
            throw new ApiError('INVALID_PARAMS')
        }
        const arrayBuffer = await file.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
        ext = file.name.split('.').pop() || 'bin'
        // Preserve original filename (without extension) for key generation
        originalName = file.name.replace(/\.[^.]+$/, '')
    } else {
        // JSON 模式
        const body = await request.json()
        const { imageBase64, base64, extension, filename } = body
        if (filename) originalName = String(filename).replace(/\.[^.]+$/, '')

        if (imageBase64) {
            const matches = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/)
            if (!matches) {
                throw new ApiError('INVALID_PARAMS')
            }
            ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
            buffer = Buffer.from(matches[2], 'base64')
        } else if (base64 && extension) {
            buffer = Buffer.from(base64, 'base64')
            ext = extension
        } else {
            throw new ApiError('INVALID_PARAMS')
        }
    }

    // Build key preserving original filename
    const safeName = originalName
        .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf\-.]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 80)

    const key = safeName
        ? `images/temp-${session.user.id}/${safeName}.${ext}`
        : `images/temp-${session.user.id}/${Date.now()}.${ext}`

    await uploadObject(buffer, key)

    // 返回签名 URL（有效期 1 小时）
    const signedUrl = getSignedUrl(key, 3600)

    return NextResponse.json({
        success: true,
        url: signedUrl,
        key
    })
})
