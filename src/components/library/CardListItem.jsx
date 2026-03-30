import styles from './CardListItem.module.css';

/** Renders a single card row in the library drawer */
export default function CardListItem({ card, onLoad, onDelete, onHistory }) {
  // Display up to 3 tags, show +N for overflow
  const tags = Array.isArray(card.tags) ? card.tags : [];
  const visibleTags = tags.slice(0, 3);
  const hiddenCount = tags.length - visibleTags.length;

  const updatedDate = card.updatedAt
    ? new Date(card.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className={styles.cardRow} onClick={onLoad} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onLoad()}>
      <div className={styles.cardMain}>
        <div className={styles.cardName}>{card.characterName || 'Unnamed'}</div>
        <div className={styles.cardMeta}>
          {updatedDate && <span className={styles.cardDate}>{updatedDate}</span>}
          {tags.length > 0 && (
            <span className={styles.tagList}>
              {visibleTags.map((t) => (
                <span key={t} className={styles.tag}>{t}</span>
              ))}
              {hiddenCount > 0 && <span className={styles.tagMore}>+{hiddenCount}</span>}
            </span>
          )}
          {card.qualityScore != null && (
            <span className={styles.qualityBadge}>{card.qualityScore}</span>
          )}
        </div>
      </div>
      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
        <button className={styles.actionBtn} onClick={onHistory} title="View history" aria-label="View history">
          📋
        </button>
        <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={onDelete} title="Delete card" aria-label="Delete card">
          🗑
        </button>
      </div>
    </div>
  );
}
