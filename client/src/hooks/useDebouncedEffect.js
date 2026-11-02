import { useEffect, useRef } from 'react';

export default function useDebouncedEffect(effect, dependencies, delay = 500) {
  const effectRef = useRef(effect);
  useEffect(() => { effectRef.current = effect; }, [effect]);
  useEffect(() => {
    const timeout = window.setTimeout(() => effectRef.current(), delay);
    return () => window.clearTimeout(timeout);
    // A dependency list is intentionally forwarded by callers, like React's built-in hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, delay]);
}
