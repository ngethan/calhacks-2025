import { useCallback, useEffect, useRef, useState } from "react";

// Simple debounce implementation
// biome-ignore lint/suspicious/noExplicitAny: Generic function type requires any for flexibility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
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

// biome-ignore lint/suspicious/noExplicitAny: Generic function type requires any for flexibility
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay = 0,
): ReturnType<typeof debounce> {
  const callbackRef = useRef(callback);
  const delayRef = useRef(delay);

  useEffect(() => {
    callbackRef.current = callback;
    delayRef.current = delay;
  });

  return useCallback(
    debounce(
      (...args: Parameters<T>) => callbackRef.current(...args),
      delayRef.current,
    ),
    [],
  );
}

export function useDebounce<T>(value: T, delay = 0): T {
  const previousValue = useRef(value);
  const [current, setCurrent] = useState(value);
  const debouncedCallback = useDebouncedCallback(
    (newValue: T) => setCurrent(newValue),
    delay,
  );
  useEffect(() => {
    // doesn't trigger the debounce timer initially
    if (value !== previousValue.current) {
      debouncedCallback(value);
      previousValue.current = value;
      // cancel the debounced callback on clean up
      return debouncedCallback.cancel;
    }
  }, [value, debouncedCallback]);

  return current;
}
