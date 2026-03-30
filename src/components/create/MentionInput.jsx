import { useState, useEffect, useRef } from 'react';
import { MentionsInput, Mention } from 'react-mentions';
import { storageClient } from '../../services/storage';
import styles from './MentionInput.module.css';

/**
 * Concept textarea with @mention autocomplete (react-mentions wrapper).
 * Phase 3: data=[] (empty list — Phase 4 populates from library API).
 *
 * react-mentions uses inline styles for overlay technique — use `style` prop
 * for textarea visual overrides, classNames for dropdown styling.
 */
export default function MentionInput({ value, onChange, disabled = false }) {
  const [cardMentions, setCardMentions] = useState([]);
  const wrapperRef = useRef(null);

  useEffect(() => {
    storageClient.listCards()
      .then((cards) => {
        if (Array.isArray(cards)) {
          setCardMentions(cards.map((c) => ({ id: c.slug, display: c.characterName || c.slug })));
        }
      })
      .catch(() => {
        // Silently ignore — mention suggestions are a convenience feature
      });
  }, []); // Load once on mount (D-19)

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    // react-mentions renders the real textarea as a child of the wrapper div
    const textarea = wrapper.querySelector('textarea');
    if (!textarea) return;

    function handleArrowKey(e) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      // aria-expanded="true" is set on the textarea when the suggestion dropdown is open
      if (textarea.getAttribute('aria-expanded') !== 'true') {
        // Dropdown is closed — stop react-mentions from consuming this event
        // so the browser can handle native cursor movement
        e.stopPropagation();
      }
    }

    // Capture phase so we run before react-mentions' bubble-phase handler
    textarea.addEventListener('keydown', handleArrowKey, true);
    return () => textarea.removeEventListener('keydown', handleArrowKey, true);
  }, []); // Run once after mount — wrapper and textarea are stable references

  return (
    <div ref={wrapperRef}>
    <MentionsInput
      value={value}
      onChange={(_e, newValue) => onChange(newValue)}
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
        data={cardMentions}
        className={styles.mention}
      />
    </MentionsInput>
    </div>
  );
}
