import { MentionsInput, Mention } from 'react-mentions';
import styles from './MentionInput.module.css';

/**
 * Concept textarea with @mention autocomplete (react-mentions wrapper).
 * Phase 3: data=[] (empty list — Phase 4 populates from library API).
 *
 * react-mentions uses inline styles for overlay technique — use `style` prop
 * for textarea visual overrides, classNames for dropdown styling.
 */
export default function MentionInput({ value, onChange, disabled = false }) {
  return (
    <MentionsInput
      value={value}
      onChange={(e, newValue) => onChange(newValue)}
      placeholder="Describe your character concept… (@ to mention a card from your library)"
      disabled={disabled}
      classNames={styles}
      style={{
        control: {
          fontFamily: 'inherit',
        },
        input: {
          // Override react-mentions default inline styles to match .textarea look
          fontFamily: 'inherit',
          fontSize: '0.92rem',
          lineHeight: '1.5',
          padding: '0.74rem 0.92rem',
          minHeight: '110px',
          resize: 'vertical',
          overflow: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--surface-strong)',
          color: 'var(--text-primary)',
        },
        highlighter: {
          fontFamily: 'inherit',
          fontSize: '0.92rem',
          lineHeight: '1.5',
          padding: '0.74rem 0.92rem',
          minHeight: '110px',
          overflow: 'hidden',
          border: '1px solid transparent',
          borderRadius: 'var(--radius-sm)',
        },
      }}
    >
      <Mention
        trigger="@"
        markup="@[__display__](__id__)"
        data={[]}
        className={styles.mention}
      />
    </MentionsInput>
  );
}
