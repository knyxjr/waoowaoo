import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { generateImage } from '@/lib/generator-api'
import { getArtStylePrompt } from '@/lib/constants'
import { uploadObject, getSignedUrl } from '@/lib/storage'

export const POST = apiHandler(async (request: NextRequest) => {
    const session = await requireAuth()

    const body = await request.json()
    const { modelKey, prompt, artStyle, customArtStylePrompt, aspectRatio, imageSize, referenceImages } = body

    if (!modelKey || typeof modelKey !== 'string') {
        throw new ApiError('INVALID_PARAMS', { message: 'modelKey is required' })
    }
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        throw new ApiError('INVALID_PARAMS', { message: 'prompt is required' })
    }

    const locale = request.headers.get('Accept-Language')?.startsWith('en') ? 'en' : 'zh'
    // Use custom art style prompt if provided, otherwise fall back to default
    const stylePrompt = customArtStylePrompt || (artStyle ? getArtStylePrompt(artStyle, locale) : '')
    const combinedPrompt = stylePrompt ? `${stylePrompt}，${prompt.trim()}` : prompt.trim()

    // Resolve reference images: convert cosKeys to signed URLs if needed
    let resolvedReferenceImages: string[] | undefined
    if (Array.isArray(referenceImages) && referenceImages.length > 0) {
        resolvedReferenceImages = referenceImages.map((img: string) => {
            if (img.startsWith('http') || img.startsWith('data:')) return img
            // Assume it's a cosKey, convert to signed URL
            return getSignedUrl(img, 3600)
        })
    }

    const result = await generateImage(session.user.id, modelKey, combinedPrompt, {
        referenceImages: resolvedReferenceImages,
        aspectRatio: aspectRatio || undefined,
        resolution: imageSize || undefined,
    })

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error || 'Generation failed' }, { status: 400 })
    }

    if (result.imageUrl) {
        return NextResponse.json({ success: true, imageUrl: result.imageUrl })
    }

    if (result.imageBase64) {
        const base64Data = result.imageBase64.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const key = `creative-studio/${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
        await uploadObject(buffer, key, 3, 'image/png')
        const signedUrl = getSignedUrl(key)
        return NextResponse.json({ success: true, imageUrl: signedUrl, cosKey: key })
    }

    return NextResponse.json({ success: false, error: 'No image returned' }, { status: 500 })
})
