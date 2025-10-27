import { renderHook } from '@testing-library/react'
import useAsyncLifecycle from '../hooks/useAsyncLifecycle'

describe('useAsyncLifecycle', () => {
  it('aborts previous controllers when begin is called again', () => {
    const { result } = renderHook(() => useAsyncLifecycle())

    const first = result.current.begin()
    expect(first.signal.aborted).toBe(false)

    const second = result.current.begin()
    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
    expect(result.current.controllerRef.current).toBe(second)
  })

  it('marks the hook as unmounted and aborts on cleanup', () => {
    const { result, unmount } = renderHook(() => useAsyncLifecycle())

    const controller = result.current.begin()
    expect(result.current.mountedRef.current).toBe(true)

    unmount()

    expect(result.current.mountedRef.current).toBe(false)
    expect(controller.signal.aborted).toBe(true)
  })
})
