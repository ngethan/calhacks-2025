import { useCallback, useEffect, useState, useRef } from 'react'

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 0
): ReturnType<typeof debounce> {
  return useCallback(debounce(callback, delay), [
    callback,
    delay,
  ])
}

export function useDebounce<T>(
  value: T,
  delay: number = 0
): T {
  const previousValue = useRef(value)
  const [current, setCurrent] = useState(value)
  const debouncedCallback = useDebouncedCallback(
    (newValue: T) => setCurrent(newValue),
    delay
  )
  useEffect(() => {
    // doesn't trigger the debounce timer initially
    if (value !== previousValue.current) {
      debouncedCallback(value)
      previousValue.current = value
      // cancel the debounced callback on clean up
      return debouncedCallback.cancel
    }
  }, [value, debouncedCallback])

  return current
}