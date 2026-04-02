import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.hoisted(() => vi.fn())
const setLogContextMock = vi.hoisted(() => vi.fn())
const withPrismaRetryMock = vi.hoisted(() => vi.fn(async <T>(fn: () => Promise<T>) => await fn()))
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn<(...args: unknown[]) => Promise<{ id: string } | null>>(),
  },
}))

vi.mock('next-auth/next', () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/prisma-retry', () => ({
  withPrismaRetry: withPrismaRetryMock,
}))

vi.mock('@/lib/config-service', () => ({
  extractModelKey: (value: string | null | undefined) => value ?? null,
}))

vi.mock('@/lib/errors/codes', () => ({
  getErrorSpec: (code: string) => ({
    defaultMessage: code === 'UNAUTHORIZED' ? 'Unauthorized' : code,
    retryable: false,
    category: 'AUTH',
    userMessageKey: `errors.${code}`,
    httpStatus: code === 'UNAUTHORIZED' ? 401 : 500,
  }),
}))

vi.mock('@/lib/logging/context', () => ({
  getLogContext: () => ({ requestId: 'req-test' }),
  setLogContext: setLogContextMock,
}))

import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'

describe('api auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' })
  })

  it('returns unauthorized when session is missing', async () => {
    const result = await requireUserAuth()

    expect(isErrorResponse(result)).toBe(true)
    expect(result.status).toBe(401)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns unauthorized when session user no longer exists in database', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'missing-user-id', name: 'ghost' },
    })
    prismaMock.user.findUnique.mockResolvedValueOnce(null)

    const result = await requireUserAuth()

    expect(isErrorResponse(result)).toBe(true)
    expect(result.status).toBe(401)
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1)
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-user-id' },
      select: { id: true },
    })
  })

  it('returns session when authenticated user still exists', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'user-1', name: 'tester' },
    })

    const result = await requireUserAuth()

    expect(isErrorResponse(result)).toBe(false)
    if (isErrorResponse(result)) {
      throw new Error('expected auth success')
    }
    expect(result.session.user.id).toBe('user-1')
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1)
  })
})
