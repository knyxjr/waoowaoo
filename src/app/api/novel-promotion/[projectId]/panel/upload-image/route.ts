import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSignedUrl } from '@/lib/storage'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'

interface PanelHistoryEntry {
  url: string
  timestamp: string
}

function parsePanelHistory(jsonValue: string | null): PanelHistoryEntry[] {
  if (!jsonValue) return []
  try {
    const parsed = JSON.parse(jsonValue)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is PanelHistoryEntry => {
      if (!entry || typeof entry !== 'object') return false
      const candidate = entry as { url?: unknown; timestamp?: unknown }
      return typeof candidate.url === 'string' && typeof candidate.timestamp === 'string'
    })
  } catch {
    return []
  }
}

/**
 * POST /api/novel-promotion/[projectId]/panel/upload-image
 * 上传自定义图片替换面板图片，保留历史记录
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const { panelId, cosKey } = body

  if (!panelId || !cosKey) {
    throw new ApiError('INVALID_PARAMS')
  }

  const panel = await prisma.novelPromotionPanel.findUnique({
    where: { id: panelId }
  })

  if (!panel) {
    throw new ApiError('NOT_FOUND')
  }

  const currentHistory = parsePanelHistory(panel.imageHistory)
  if (panel.imageUrl) {
    currentHistory.push({
      url: panel.imageUrl,
      timestamp: new Date().toISOString()
    })
  }

  const signedUrl = getSignedUrl(cosKey, 7 * 24 * 3600)

  await prisma.novelPromotionPanel.update({
    where: { id: panelId },
    data: {
      imageUrl: cosKey,
      imageHistory: JSON.stringify(currentHistory),
      candidateImages: null
    }
  })

  return NextResponse.json({
    success: true,
    imageUrl: signedUrl,
    cosKey,
  })
})
