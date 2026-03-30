import { useEffect } from 'react';
import useGenerationStore from '../../stores/useGenerationStore';
import styles from './ImageSlot.module.css';

/**
 * Portrait image slot for CharacterEditor.
 * - Shows placeholder with dashed border when no image.
 * - Shows pulsing animation during generation.
 * - After generation/upload: image fills slot with object-fit: cover.
 *
 * Upload Image and Generate Image buttons are NOT inside this component —
 * they live in CharacterEditor's left column per D-03/D-04.
 * ImageSlot is purely the image frame display.
 */
export default function ImageSlot() {
  const imageDisplayUrl = useGenerationStore((s) => s.imageDisplayUrl);
  const isImageGenerating = useGenerationStore((s) => s.isImageGenerating);

  // Cleanup blob URL on unmount or when a new image replaces it
  useEffect(() => {
    return () => {
      if (imageDisplayUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(imageDisplayUrl);
      }
    };
  }, [imageDisplayUrl]);

  return (
    <div className={`${styles.slot} ${isImageGenerating ? styles.generating : ''}`}>
      {imageDisplayUrl ? (
        <img
          src={imageDisplayUrl}
          alt="Character portrait"
          className={styles.portrait}
        />
      ) : (
        <div className={styles.placeholder}>
          <span className={styles.placeholderIcon}>🖼</span>
          <span className={styles.placeholderText}>No image</span>
        </div>
      )}
    </div>
  );
}
