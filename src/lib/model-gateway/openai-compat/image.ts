import type { GenerateResult } from '@/lib/generators/base'
import type { OpenAICompatImageRequest } from '../types'
import {
  createOpenAICompatClient,
  readStringOption,
  resolveOpenAICompatClientConfig,
  toUploadFile,
  toInlineData,
} from './common'

type OpenAIImageResponseFormat = 'url' | 'b64_json'
type OpenAIImageOutputFormat = 'png' | 'jpeg' | 'webp'
type OpenAIImageGenerateQuality = 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto'
type OpenAIImageGenerateSize =
  | 'auto'
  | '1024x1024'
  | '1536x1024'
  | '1024x1536'
  | '256x256'
  | '512x512'
  | '1792x1024'
  | '1024x1792'

const OPENAI_IMAGE_OPTION_KEYS = new Set([
  'provider',
  'modelId',
  'modelKey',
  'size',
  'resolution',
  'quality',
  'responseFormat',
  'outputFormat',
])

function assertAllowedOptions(options: Record<string, unknown>) {
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue
    if (!OPENAI_IMAGE_OPTION_KEYS.has(key)) {
      throw new Error(`OPENAI_COMPAT_IMAGE_OPTION_UNSUPPORTED: ${key}`)
    }
  }
}

function normalizeResponseFormat(value: unknown): OpenAIImageResponseFormat {
  const normalized = readStringOption(value, 'responseFormat')
  if (!normalized) return 'b64_json'
  if (normalized === 'url' || normalized === 'b64_json') return normalized
  throw new Error(`OPENAI_COMPAT_IMAGE_OPTION_UNSUPPORTED: responseFormat=${normalized}`)
}

function normalizeOutputFormat(value: unknown): OpenAIImageOutputFormat | undefined {
  const normalized = readStringOption(value, 'outputFormat')
  if (!normalized) return undefined
  if (normalized === 'png' || normalized === 'jpeg' || normalized === 'webp') return normalized
  throw new Error(`OPENAI_COMPAT_IMAGE_OPTION_UNSUPPORTED: outputFormat=${normalized}`)
}

function normalizeGenerateQuality(value: unknown): OpenAIImageGenerateQuality | undefined {
  const normalized = readStringOption(value, 'quality')
  if (!normalized) return undefined
  if (
    normalized === 'standard'
    || normalized === 'hd'
    || normalized === 'low'
    || normalized === 'medium'
    || normalized === 'high'
    || normalized === 'auto'
  ) {
    return normalized
  }
  throw new Error(`OPENAI_COMPAT_IMAGE_OPTION_UNSUPPORTED: quality=${normalized}`)
}

function normalizeOpenAIImageSize(value: string | undefined): OpenAIImageGenerateSize | undefined {
  if (!value) return undefined
  if (
    value === 'auto'
    || value === '1024x1024'
    || value === '1536x1024'
    || value === '1024x1536'
    || value === '256x256'
    || value === '512x512'
    || value === '1792x1024'
    || value === '1024x1792'
  ) {
    return value
  }
  throw new Error(`OPENAI_COMPAT_IMAGE_OPTION_UNSUPPORTED: size=${value}`)
}

function resolveRawSize(options: Record<string, unknown>): string | undefined {
  const size = readStringOption(options.size, 'size')
  const resolution = readStringOption(options.resolution, 'resolution')
  if (size && resolution && size !== resolution) {
    throw new Error('OPENAI_COMPAT_IMAGE_OPTION_CONFLICT: size and resolution must match')
  }
  return size || resolution
}

function resolveModelId(modelId: string | undefined, options: Record<string, unknown>): string {
  const optionModelId = readStringOption(options.modelId, 'modelId')
  const selected = (modelId || optionModelId || '').trim()
  if (selected) return selected
  return 'gpt-image-1'
}

function toMimeFromOutputFormat(outputFormat: string | undefined): string {
  if (outputFormat === 'jpeg' || outputFormat === 'jpg') return 'image/jpeg'
  if (outputFormat === 'webp') return 'image/webp'
  return 'image/png'
}

function readFirstImagePayload(response: unknown): { b64Json: string | null; url: string | null } {
  if (typeof response !== 'object' || response === null) {
    return { b64Json: null, url: null }
  }
  const data = (response as { data?: unknown }).data
  if (!Array.isArray(data) || data.length === 0) {
    return { b64Json: null, url: null }
  }
  const first = data[0]
  if (typeof first !== 'object' || first === null) {
    return { b64Json: null, url: null }
  }
  const rawB64 = (first as { b64_json?: unknown }).b64_json
  const rawUrl = (first as { url?: unknown }).url
  return {
    b64Json: typeof rawB64 === 'string' ? rawB64 : null,
    url: typeof rawUrl === 'string' ? rawUrl : null,
  }
}

export async function generateImageViaOpenAICompat(request: OpenAICompatImageRequest): Promise<GenerateResult> {
  const {
    userId,
    providerId,
    modelId,
    prompt,
    referenceImages = [],
    options = {},
  } = request

  assertAllowedOptions(options)
  const config = await resolveOpenAICompatClientConfig(userId, providerId)
  const client = createOpenAICompatClient(config)

  const normalizedModelId = resolveModelId(modelId, options)
  const responseFormat = normalizeResponseFormat(options.responseFormat)
  const outputFormat = normalizeOutputFormat(options.outputFormat)
  const quality = normalizeGenerateQuality(options.quality)
  const rawSize = resolveRawSize(options)
  const size = normalizeOpenAIImageSize(rawSize)

  const forceChatMode = config.imageChatMode === true || process.env.WAOOWAOO_IMAGE_FORCE_CHAT_API === 'true'

  if (forceChatMode) {
    // ==========================================================
    // 强制 Fallback：直接使用 OpenAI /v1/chat/completions 进行“聊天画图”
    // ==========================================================
    const chatBaseUrl = config.baseUrl || 'https://api.openai.com/v1'
    const chatApiKey = config.apiKey || ''
    const chatPath = chatBaseUrl.replace(/\/+$/, '') + '/chat/completions'

    console.log(`[OPENAI_CHAT_MODE] 强制请求 Chat 聊天端点出图: ${chatPath}`)
    const chatContents: any[] = [{ type: 'text', text: prompt }]

    for (const referenceImage of referenceImages.slice(0, 4)) {
      if (typeof referenceImage === 'string') {
        const inlineData = await toInlineData(referenceImage)
        if (inlineData) {
          chatContents.push({
            type: 'image_url',
            image_url: { url: `data:${inlineData.mimeType};base64,${inlineData.data}` }
          })
        }
      }
    }

    const chatBody = {
      model: normalizedModelId,
      messages: [{ role: 'user', content: chatContents }],
    }

    const cRes = await fetch(chatPath, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${chatApiKey}`,
      },
      body: JSON.stringify(chatBody),
    })

    const chatText = await cRes.text()
    
    // 暴力正则：找 base64
    const base64Match = chatText.match(/"(?:data:image\/[^;]+;base64,)?([A-Za-z0-9+/]{1000,}={0,2})"/);
    if (base64Match && base64Match[1]) {
      console.log(`[OPENAI_CHAT_MODE] ✅ 成功获取到 Base64!`)
      return { success: true, imageBase64: base64Match[1], imageUrl: `data:image/png;base64,${base64Match[1]}` }
    }

    // 暴力正则：找 http 链接 
    const urlMatch = chatText.match(/(https?:\/\/[^\s"'\\]+\.(?:png|jpg|jpeg|webp|gif)[^\s"'\\]*)/i) || 
                     chatText.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
    if (urlMatch && urlMatch[1]) {
      console.log(`[OPENAI_CHAT_MODE] ✅ 成功获取到 URL: ${urlMatch[1]}`)
      return { success: true, imageUrl: urlMatch[1] }
    }

    if (!cRes.ok) {
       // 注入特定关键字 fieldinvalid (被 normalizeAnyError 归为 INVALID_PARAMS，默认禁用重试)
       throw new Error(`[fieldinvalid] OPENAI_COMPATIBLE_CHAT_MODE_FAILED: HTTP ${cRes.status}: ${chatText.slice(0, 250)}`)
    }
    throw new Error(`[fieldinvalid] OPENAI_COMPATIBLE_IMAGE_EMPTY_RESPONSE: 已尝试使用 Chat 模式出图，但未发现图片信息: ${chatText.slice(0, 300)}`)
  }

  // ==========================================================
  // 未开启开关：常规请求。没有任何兜底捕获，失败就报错
  // ==========================================================
  if (referenceImages.length > 0) {
    let response;
    try {
      response = await client.images.edit({
        model: normalizedModelId,
        prompt,
        image: await Promise.all(referenceImages.map((image, index) => toUploadFile(image, index))),
        response_format: responseFormat,
        ...(outputFormat ? { output_format: outputFormat } : {}),
        ...(quality ? { quality } : {}),
        ...(size ? { size } : {}),
      } as unknown as Parameters<typeof client.images.edit>[0])
    } catch (err: unknown) {
      const ms = err instanceof Error ? err.message : String(err)
      throw new Error(`[fieldinvalid] OPENAI_COMPAT_IMAGE_EDIT_FAILED: ${ms}`)
    }

    const imagePayload = readFirstImagePayload(response)
    const imageBase64 = imagePayload.b64Json
    if (typeof imageBase64 === 'string' && imageBase64.trim().length > 0) {
      const mimeType = toMimeFromOutputFormat(outputFormat)
      return {
        success: true,
        imageBase64,
        imageUrl: `data:${mimeType};base64,${imageBase64}`,
      }
    }
    const imageUrl = imagePayload.url
    if (typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
      return { success: true, imageUrl }
    }
    throw new Error('[fieldinvalid] OPENAI_COMPAT_IMAGE_EMPTY_RESPONSE: no image data returned')
  }

  let response;
  try {
     response = await client.images.generate({
       model: normalizedModelId,
       prompt,
       response_format: responseFormat,
       ...(outputFormat ? { output_format: outputFormat } : {}),
       ...(quality ? { quality } : {}),
       ...(size ? { size } : {}),
     } as unknown as Parameters<typeof client.images.generate>[0])
  } catch (err: unknown) {
      const ms = err instanceof Error ? err.message : String(err)
      throw new Error(`[fieldinvalid] OPENAI_COMPAT_IMAGE_GENERATE_FAILED: ${ms}`)
  }

  const imagePayload = readFirstImagePayload(response)
  const imageBase64 = imagePayload.b64Json
  if (typeof imageBase64 === 'string' && imageBase64.trim().length > 0) {
    const mimeType = toMimeFromOutputFormat(outputFormat)
    return {
      success: true,
      imageBase64,
      imageUrl: `data:${mimeType};base64,${imageBase64}`,
    }
  }
  const imageUrl = imagePayload.url
  if (typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
    return { success: true, imageUrl }
  }
  throw new Error('[fieldinvalid] OPENAI_COMPAT_IMAGE_EMPTY_RESPONSE: no image data returned')
}
