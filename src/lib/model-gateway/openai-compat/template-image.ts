import type { GenerateResult } from '@/lib/generators/base'
import type { OpenAICompatImageRequest } from '../types'
import {
  buildRenderedTemplateRequest,
  buildTemplateVariables,
  extractTemplateError,
  normalizeResponseJson,
  readJsonPath,
} from '@/lib/openai-compat-template-runtime'
import { parseModelKeyStrict } from '@/lib/model-config-contract'
import { resolveOpenAICompatClientConfig, toInlineData } from './common'

const OPENAI_COMPAT_PROVIDER_PREFIX = 'openai-compatible:'
const PROVIDER_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function encodeProviderToken(providerId: string): string {
  const value = providerId.trim()
  if (value.startsWith(OPENAI_COMPAT_PROVIDER_PREFIX)) {
    const uuid = value.slice(OPENAI_COMPAT_PROVIDER_PREFIX.length).trim()
    if (PROVIDER_UUID_PATTERN.test(uuid)) {
      return `u_${uuid.toLowerCase()}`
    }
  }
  return `b64_${Buffer.from(value, 'utf8').toString('base64url')}`
}

function encodeModelRef(modelRef: string): string {
  return Buffer.from(modelRef, 'utf8').toString('base64url')
}

function resolveModelRef(request: OpenAICompatImageRequest): string {
  const modelId = typeof request.modelId === 'string' ? request.modelId.trim() : ''
  if (modelId) return modelId
  const parsed = typeof request.modelKey === 'string' ? parseModelKeyStrict(request.modelKey) : null
  if (parsed?.modelId) return parsed.modelId
  throw new Error('OPENAI_COMPAT_IMAGE_MODEL_REF_REQUIRED')
}

export async function generateImageViaOpenAICompatTemplate(
  request: OpenAICompatImageRequest,
): Promise<GenerateResult> {
  if (!request.template) {
    throw new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_REQUIRED')
  }
  if (request.template.mediaType !== 'image') {
    throw new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_MEDIA_TYPE_INVALID')
  }

  const config = await resolveOpenAICompatClientConfig(request.userId, request.providerId)
  const firstReference = Array.isArray(request.referenceImages) && request.referenceImages.length > 0
    ? request.referenceImages[0]
    : ''
  const variables = buildTemplateVariables({
    model: request.modelId || 'gpt-image-1',
    prompt: request.prompt,
    image: firstReference,
    images: request.referenceImages || [],
    aspectRatio: typeof request.options?.aspectRatio === 'string' ? request.options.aspectRatio : undefined,
    resolution: typeof request.options?.resolution === 'string' ? request.options.resolution : undefined,
    size: typeof request.options?.size === 'string' ? request.options.size : undefined,
    extra: request.options,
  })

  const forceChatMode = config.imageChatMode === true || process.env.WAOOWAOO_IMAGE_FORCE_CHAT_API === 'true'

  if (forceChatMode) {
    const fallbackBaseUrl = config.baseUrl || 'https://api.openai.com/v1'
    const fallbackApiKey = config.apiKey || ''
    const fallbackChatPath = fallbackBaseUrl.replace(/\/+$/, '') + '/chat/completions'
    
    // 安全起见，只用 text 传入提示词
    const fallbackModelId = request.modelId || 'gpt-image-1'

    const chatContents: any[] = [{ type: 'text', text: request.prompt || 'Draw an image' }]
    const refImages = Array.isArray(request.referenceImages) ? request.referenceImages : []
    for (const referenceImage of refImages.slice(0, 4)) {
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
      model: fallbackModelId,
      messages: [{ role: 'user', content: chatContents }],
    }

    const cRes = await fetch(fallbackChatPath, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${fallbackApiKey}`,
      },
      body: JSON.stringify(chatBody),
    })

    const chatText = await cRes.text()
    console.log(`[OPENAI_COMPAT_TEMPLATE] 强制短路兜底相应: ${chatText.slice(0, 300)}`)

    // 暴力提取 Base64
    const base64Match = chatText.match(/"(?:data:image\/[^;]+;base64,)?([A-Za-z0-9+/]{1000,}={0,2})"/);
    if (base64Match && base64Match[1]) {
      console.log(`[OPENAI_COMPAT_TEMPLATE] ✅ Chat 短路成功获取到 Base64!`)
      return { success: true, imageUrl: `data:image/png;base64,${base64Match[1]}` }
    }

    // 暴力提取 URL
    const urlMatch = chatText.match(/(https?:\/\/[^\s"'\\]+\.(?:png|jpg|jpeg|webp|gif)[^\s"'\\]*)/i) || 
                     chatText.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
    if (urlMatch && urlMatch[1]) {
      console.log(`[OPENAI_COMPAT_TEMPLATE] ✅ Chat 短路成功获取到 URL: ${urlMatch[1]}`)
      return { success: true, imageUrl: urlMatch[1] }
    }

    if (!cRes.ok) throw new Error(`OPENAI_COMPATIBLE_CHAT_MODE_FAILED: HTTP ${cRes.status}: ${chatText.slice(0, 250)}`)
    throw new Error(`OPENAI_COMPATIBLE_IMAGE_EMPTY_RESPONSE: 模板层强制通过对话提图，但响应中没有有效图片 ${chatText.slice(0, 300)}`)
  }

  const createRequest = await buildRenderedTemplateRequest({
    baseUrl: config.baseUrl,
    endpoint: request.template.create,
    variables,
    defaultAuthHeader: `Bearer ${config.apiKey}`,
  })
  if (['POST', 'PUT', 'PATCH'].includes(createRequest.method) && !createRequest.body) {
    throw new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_CREATE_BODY_REQUIRED')
  }
  const response = await fetch(createRequest.endpointUrl, {
    method: createRequest.method,
    headers: createRequest.headers,
    ...(createRequest.body ? { body: createRequest.body } : {}),
  })
  const rawText = await response.text().catch(() => '')
  const payload = normalizeResponseJson(rawText)
  
  // ==========================================================
  // 常规原生抛错（不带任何兜底逻辑）
  // ==========================================================
  if (!response.ok) {
    throw new Error(extractTemplateError(request.template, payload, response.status))
  }

  if (request.template.mode === 'sync') {
    const outputUrl = readJsonPath(payload, request.template.response.outputUrlPath)
    if (typeof outputUrl === 'string' && outputUrl.trim().length > 0) {
      return {
        success: true,
        imageUrl: outputUrl.trim(),
      }
    }
    const outputUrls = readJsonPath(payload, request.template.response.outputUrlsPath)
    if (Array.isArray(outputUrls) && outputUrls.length > 0) {
      const first = outputUrls[0]
      if (typeof first === 'string' && first.trim()) {
        return {
          success: true,
          imageUrl: first.trim(),
        }
      }
      if (first && typeof first === 'object' && !Array.isArray(first)) {
        const firstUrl = (first as { url?: unknown }).url
        if (typeof firstUrl === 'string' && firstUrl.trim()) {
          return {
            success: true,
            imageUrl: firstUrl.trim(),
          }
        }
      }
    }
    throw new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_OUTPUT_NOT_FOUND')
  }

  const taskIdRaw = readJsonPath(payload, request.template.response.taskIdPath)
  const taskId = typeof taskIdRaw === 'string' ? taskIdRaw.trim() : ''
  if (!taskId) {
    throw new Error('OPENAI_COMPAT_IMAGE_TEMPLATE_TASK_ID_NOT_FOUND')
  }
  const providerToken = encodeProviderToken(config.providerId)
  const modelRefToken = encodeModelRef(resolveModelRef(request))
  return {
    success: true,
    async: true,
    requestId: taskId,
    externalId: `OCOMPAT:IMAGE:${providerToken}:${modelRefToken}:${taskId}`,
  }
}
