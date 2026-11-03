import { useEffect } from 'react';

export default function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    if (title && title.trim()) {
      document.title = `${title.trim()} – Otion`;
    } else {
      document.title = 'Otion – Notes and ideas in flow';
    }
    return () => {
      document.title = previous;
    };
  }, [title]);
}
