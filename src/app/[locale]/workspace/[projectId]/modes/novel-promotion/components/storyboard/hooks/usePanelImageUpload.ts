'use client'

import { logError as _ulogError } from '@/lib/logging/core'
import { useCallback, useRef } from 'react'
import { useUploadAssetHubTempMedia } from '@/lib/query/mutations/asset-hub-creation-mutations'
import { requestJsonWithError } from '@/lib/query/mutations/mutation-shared'
import {
  useRefreshProjectAssets,
  useRefreshEpisodeData,
  useRefreshStoryboards,
} from '@/lib/query/hooks'
import { usePanelEpisodeCachePatch } from './usePanelEpisodeCachePatch'

interface UsePanelImageUploadProps {
  projectId: string
  episodeId?: string
  onUploaded?: (panelId: string, imageUrl: string) => void
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function usePanelImageUpload({
  projectId,
  episodeId,
  onUploaded,
}: UsePanelImageUploadProps) {
  const uploadTempMutation = useUploadAssetHubTempMedia()
  const onSilentRefresh = useRefreshProjectAssets(projectId)
  const refreshEpisode = useRefreshEpisodeData(projectId, episodeId ?? null)
  const refreshStoryboards = useRefreshStoryboards(episodeId ?? null)
  const patchPanelInEpisodeCache = usePanelEpisodeCachePatch({ projectId, episodeId })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingPanelIdRef = useRef<string | null>(null)

  const handleFileSelected = useCallback(async (file: File, panelId: string) => {
    try {
      const base64 = await readFileAsBase64(file)

      const uploadResult = await uploadTempMutation.mutateAsync({ imageBase64: base64 })
      if (!uploadResult.key) throw new Error('Upload returned no key')

      const result = await requestJsonWithError<{ imageUrl: string; cosKey: string }>(
        `/api/novel-promotion/${projectId}/panel/upload-image`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ panelId, cosKey: uploadResult.key }),
        },
        'Upload panel image failed',
      )

      patchPanelInEpisodeCache(panelId, {
        imageUrl: result.imageUrl,
        candidateImages: null,
        imageTaskRunning: false,
        imageErrorMessage: null,
      })

      onUploaded?.(panelId, result.imageUrl)

      if (onSilentRefresh) await onSilentRefresh()
      refreshEpisode()
      refreshStoryboards()
    } catch (error: unknown) {
      _ulogError('[usePanelImageUpload] upload failed:', error)
      throw error
    }
  }, [
    onSilentRefresh,
    onUploaded,
    patchPanelInEpisodeCache,
    projectId,
    refreshEpisode,
    refreshStoryboards,
    uploadTempMutation,
  ])

  const triggerUpload = useCallback((panelId: string) => {
    pendingPanelIdRef.current = panelId

    if (!fileInputRef.current) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.style.display = 'none'
      document.body.appendChild(input)
      fileInputRef.current = input

      input.addEventListener('change', () => {
        const file = input.files?.[0]
        const pid = pendingPanelIdRef.current
        if (file && pid) {
          handleFileSelected(file, pid)
        }
        input.value = ''
      })
    }

    fileInputRef.current.click()
  }, [handleFileSelected])

  return {
    triggerUpload,
    isUploading: uploadTempMutation.isPending,
  }
}
