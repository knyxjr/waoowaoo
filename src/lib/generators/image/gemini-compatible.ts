import { getProviderConfig } from '@/lib/api-config'
import { getImageBase64Cached } from '@/lib/image-cache'
import { BaseImageGenerator, type GenerateResult, type ImageGenerateParams } from '../base'
import { setProxy } from '../../../../lib/prompts/proxy'

type GeminiCompatibleContentPart = { inlineData: { mimeType: string; data: string } } | { text: string }

type GeminiCompatibleOptions = {
  aspectRatio?: string
  resolution?: string
  provider?: string
  modelId?: string
  modelKey?: string
}

function toAbsoluteUrlIfNeeded(value: string): string {
  if (!value.startsWith('/')) return value
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return `${baseUrl}${value}`
}

function parseDataUrl(value: string): { mimeType: string; base64: string } | null {
  const marker = ';base64,'
  const markerIndex = value.indexOf(marker)
  if (!value.startsWith('data:') || markerIndex === -1) return null
  const mimeType = value.slice(5, markerIndex)
  const base64 = value.slice(markerIndex + marker.length)
  if (!mimeType || !base64) return null
  return { mimeType, base64 }
}

async function toInlineData(imageSource: string): Promise<{ mimeType: string; data: string } | null> {
  const parsedDataUrl = parseDataUrl(imageSource)
  if (parsedDataUrl) {
    return { mimeType: parsedDataUrl.mimeType, data: parsedDataUrl.base64 }
  }

  if (imageSource.startsWith('http://') || imageSource.startsWith('https://') || imageSource.startsWith('/')) {
    const cachedDataUrl = await getImageBase64Cached(toAbsoluteUrlIfNeeded(imageSource))
    const parsedCachedDataUrl = parseDataUrl(cachedDataUrl)
    if (!parsedCachedDataUrl) return null
    return { mimeType: parsedCachedDataUrl.mimeType, data: parsedCachedDataUrl.base64 }
  }

  return { mimeType: 'image/png', data: imageSource }
}

function assertAllowedOptions(options: Record<string, unknown>) {
  const allowedKeys = new Set([
    'provider',
    'modelId',
    'modelKey',
    'aspectRatio',
    'resolution',
  ])
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue
    if (!allowedKeys.has(key)) {
      throw new Error(`GEMINI_COMPATIBLE_IMAGE_OPTION_UNSUPPORTED: ${key}`)
    }
  }
}

/**
 * 从原始 JSON 对象中递归搜索图片数据。
 * 兼容 snake_case (inline_data / mime_type) 和 camelCase (inlineData / mimeType)。
 */
function extractImageFromRawJson(obj: any): { mimeType: string; data: string } | null {
  if (!obj || typeof obj !== 'object') return null

  // camelCase
  if (obj.inlineData?.data && typeof obj.inlineData.data === 'string' && obj.inlineData.data.length > 100) {
    return {
      mimeType: obj.inlineData.mimeType || obj.inlineData.mime_type || 'image/png',
      data: obj.inlineData.data,
    }
  }

  // snake_case
  if (obj.inline_data?.data && typeof obj.inline_data.data === 'string' && obj.inline_data.data.length > 100) {
    return {
      mimeType: obj.inline_data.mime_type || obj.inline_data.mimeType || 'image/png',
      data: obj.inline_data.data,
    }
  }

  // 递归
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = extractImageFromRawJson(item)
      if (result) return result
    }
  } else {
    for (const key of Object.keys(obj)) {
      const result = extractImageFromRawJson(obj[key])
      if (result) return result
    }
  }

  return null
}

/**
 * 从原始响应文本中提取 text part 里嵌入的 base64 图片。
 * 兼容: markdown `![...](data:image/...;base64,...)` 和裸 data URL。
 */
function extractBase64FromTextParts(rawText: string): { mimeType: string; data: string } | null {
  // Match data:image/xxx;base64,<long-base64> anywhere in the text
  const match = rawText.match(/data:(image\/[^;]+);base64,([A-Za-z0-9+/]{1000,}={0,2})/)
  if (match) {
    return { mimeType: match[1], data: match[2] }
  }
  return null
}

export class GeminiCompatibleImageGenerator extends BaseImageGenerator {
  private readonly modelId?: string
  private readonly providerId?: string

  constructor(modelId?: string, providerId?: string) {
    super()
    this.modelId = modelId
    this.providerId = providerId
  }

  protected async doGenerate(params: ImageGenerateParams): Promise<GenerateResult> {
    const { userId, prompt, referenceImages = [], options = {} } = params
    assertAllowedOptions(options)

    const providerId = this.providerId || 'gemini-compatible'
    const providerConfig = await getProviderConfig(userId, providerId)
    if (!providerConfig.baseUrl) {
      throw new Error(`PROVIDER_BASE_URL_MISSING: ${providerId}`)
    }

    await setProxy()

    const normalizedOptions = options as GeminiCompatibleOptions
    const model = this.modelId || normalizedOptions.modelId || 'gemini-3.1-flash-image'
    const rawBaseUrl = providerConfig.baseUrl.replace(/\/+$/, '')

    const forceChatMode = providerConfig.imageChatMode === true || process.env.WAOOWAOO_IMAGE_FORCE_CHAT_API === 'true'

    if (forceChatMode) {
      // ==========================================================
      // 开关开启：强制当做 OpenAI 聊天处理，根本不碰 Gemini
      // ==========================================================
      let chatPath = rawBaseUrl.endsWith('/v1') 
        ? `${rawBaseUrl}/chat/completions`
        : (rawBaseUrl.endsWith('/v1beta') ? `${rawBaseUrl.replace('/v1beta', '/v1')}/chat/completions` : `${rawBaseUrl}/v1/chat/completions`)

      console.log(`[GEMINI_CHAT_MODE] 强制转向 Chat Endpoint: ${chatPath}`)
      
      const chatContents: any[] = [{ type: 'text', text: prompt }]
      for (const referenceImage of referenceImages.slice(0, 4)) {
        const inlineData = await toInlineData(referenceImage)
        if (inlineData) {
          chatContents.push({
            type: 'image_url',
            image_url: { url: `data:${inlineData.mimeType};base64,${inlineData.data}` }
          })
        }
      }

      const chatBody = {
        model: model,
        messages: [{ role: 'user', content: chatContents }]
      }

      const cRes = await fetch(chatPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerConfig.apiKey}`,
        },
        body: JSON.stringify(chatBody),
      })
      
      const chatText = await cRes.text()
      console.log(`[GEMINI_CHAT_MODE] 收到响应状态: ${cRes.status}`)
      
      const base64Match = chatText.match(/"(?:data:image\/[^;]+;base64,)?([A-Za-z0-9+/]{1000,}={0,2})"/);
      if (base64Match && base64Match[1]) {
        console.log(`[GEMINI_CHAT_MODE] ✅ 成功提取 Base64!`)
        return { success: true, imageBase64: base64Match[1], imageUrl: `data:image/png;base64,${base64Match[1]}` }
      }

      const urlMatch = chatText.match(/(https?:\/\/[^\s"'\\]+\.(?:png|jpg|jpeg|webp|gif)[^\s"'\\]*)/i) || 
                       chatText.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
      if (urlMatch && urlMatch[1]) {
        console.log(`[GEMINI_CHAT_MODE] ✅ 成功提取直接链接!`)
        return { success: true, imageUrl: urlMatch[1] }
      }
      
      if (!cRes.ok) {
        throw new Error(`[fieldinvalid] GEMINI_COMPATIBLE_CHAT_MODE_FAILED: HTTP ${cRes.status}: ${chatText.slice(0, 250)}`)
      }
      throw new Error(`[fieldinvalid] GEMINI_COMPATIBLE_IMAGE_EMPTY_RESPONSE: 已尝试使用 Chat 会话接口出图，但响应中没有附带图片: ${chatText.slice(0, 300)}`)
    }

    // ==========================================================
    // 开关未开：传统 Gemini 请求。失败就失败，不会再做处理
    // ==========================================================
    let apiPath = rawBaseUrl.endsWith('/v1beta') || rawBaseUrl.endsWith('/v1')
      ? `${rawBaseUrl}/models/${model}:generateContent`
      : `${rawBaseUrl}/v1beta/models/${model}:generateContent`

    const parts: GeminiCompatibleContentPart[] = []
    for (const referenceImage of referenceImages.slice(0, 14)) {
      let inlineData: { mimeType: string; data: string } | null
      try {
        inlineData = await toInlineData(referenceImage)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`GEMINI_COMPATIBLE_REFERENCE_FETCH_FAILED: 无法获取参考图片 (${msg})`)
      }
      if (!inlineData) throw new Error('GEMINI_COMPATIBLE_REFERENCE_INVALID: failed to parse reference image')
      parts.push({ inlineData })
    }
    parts.push({ text: prompt })

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        ...(normalizedOptions.aspectRatio || normalizedOptions.resolution ? {
          imageConfig: {
            ...(normalizedOptions.aspectRatio ? { aspectRatio: normalizedOptions.aspectRatio } : {}),
            ...(normalizedOptions.resolution ? { image_size: normalizedOptions.resolution } : {}),
          },
        } : {}),
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }

    console.log(`[GEMINI_NATIVE] 尝试原生 Endpoint: ${apiPath}`)
    let gRes: Response
    try {
      gRes = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': providerConfig.apiKey,
          'Authorization': `Bearer ${providerConfig.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`GEMINI_COMPATIBLE_API_UNREACHABLE: 无法连接到 ${apiPath.split('/models')[0]} (${msg})`)
    }
    
    const gText = await gRes.text()
    
    if (!gRes.ok) {
        throw new Error(`[fieldinvalid] GEMINI_API_FAILED: Native HTTP ${gRes.status}: ${gText.slice(0, 250)}`)
    }

    let data: any
    try {
      data = JSON.parse(gText)
    } catch {
      throw new Error(`[fieldinvalid] GEMINI_COMPATIBLE_IMAGE_PARSE_ERROR: ${gText.slice(0, 150)}`)
    }

    const imageResult = extractImageFromRawJson(data)
    if (imageResult) {
       console.log(`[GEMINI_NATIVE] ✅ 原生 Endpoint 提取成功!`)
       return {
          success: true,
          imageBase64: imageResult.data,
          imageUrl: `data:${imageResult.mimeType};base64,${imageResult.data}`,
       }
    }

    // Fallback: some proxies return base64 inside text parts as markdown or raw data URLs
    const base64FromText = extractBase64FromTextParts(gText)
    if (base64FromText) {
       console.log(`[GEMINI_NATIVE] ✅ 从 text part 中提取到 base64 图片`)
       return {
          success: true,
          imageBase64: base64FromText.data,
          imageUrl: `data:${base64FromText.mimeType};base64,${base64FromText.data}`,
       }
    }

    throw new Error(`[fieldinvalid] GEMINI_COMPATIBLE_IMAGE_EMPTY_RESPONSE: 请求已返回 200，但中转站剥离或缺失了图片 (arts:[]). 原报文片段: ${gText.slice(0, 150)}`)
  }
}
