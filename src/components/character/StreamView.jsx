import { useRef, useEffect } from 'react';
import useGenerationStore from '../../stores/useGenerationStore';
import styles from './StreamView.module.css';

export default function StreamView() {
  const streamText = useGenerationStore((s) => s.streamText);
  const isGenerating = useGenerationStore((s) => s.isGenerating);
  const containerRef = useRef(null);
  const userScrolledUp = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || userScrolledUp.current) return;
    el.scrollTop = el.scrollHeight;
  }, [streamText]);

  // Reset scroll tracking when a new generation starts
  useEffect(() => {
    if (isGenerating) {
      userScrolledUp.current = false;
    }
  }, [isGenerating]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    // Pause auto-scroll if user has scrolled up more than 50px from bottom
    userScrolledUp.current = el.scrollTop < el.scrollHeight - el.clientHeight - 50;
  }

  return (
    <pre
      ref={containerRef}
      className={styles.streamBox}
      onScroll={handleScroll}
    >
      {streamText || (
        <span className={styles.placeholder}>Waiting for generation to start…</span>
      )}
    </pre>
  );
}
