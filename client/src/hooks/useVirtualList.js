import { useEffect, useMemo, useState } from 'react';

/**
 * Lightweight windowed virtualization hook for rendering large lists efficiently.
 * @param {Array} items - The list of items to render
 * @param {Object} options
 * @param {number} options.itemHeight - Estimated height in px per item (e.g. 64px for dashboard rows)
 * @param {number} options.overscan - Extra items to render above/below viewport (default: 5)
 * @param {React.RefObject} options.containerRef - Ref to the scroll container (window if null)
 */
export default function useVirtualList(items = [], { itemHeight = 60, overscan = 5, containerRef = null } = {}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  useEffect(() => {
    const target = containerRef?.current || window;

    const handleScroll = () => {
      const currentScroll = containerRef?.current
        ? containerRef.current.scrollTop
        : window.scrollY;
      setScrollTop(currentScroll);
    };

    const handleResize = () => {
      const currentHeight = containerRef?.current
        ? containerRef.current.clientHeight
        : window.innerHeight;
      setViewportHeight(currentHeight);
    };

    handleResize();

    target.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      target.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef]);

  const totalHeight = items.length * itemHeight;

  const { startIndex, endIndex, virtualItems } = useMemo(() => {
    // If list is small (< 40 items), render all to avoid overhead
    if (items.length <= 40) {
      return {
        startIndex: 0,
        endIndex: items.length,
        virtualItems: items.map((item, index) => ({
          item,
          index,
          offsetTop: index * itemHeight,
        })),
      };
    }

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2 * overscan;
    const end = Math.min(items.length, start + visibleCount);

    const slice = [];
    for (let i = start; i < end; i += 1) {
      slice.push({
        item: items[i],
        index: i,
        offsetTop: i * itemHeight,
      });
    }

    return {
      startIndex: start,
      endIndex: end,
      virtualItems: slice,
    };
  }, [items, itemHeight, scrollTop, viewportHeight, overscan]);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    isVirtualized: items.length > 40,
  };
}
