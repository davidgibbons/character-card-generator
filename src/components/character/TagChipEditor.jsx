import { useState, useRef, useCallback } from 'react';
import styles from './TagChipEditor.module.css';

/**
 * TagChipEditor — renders tags as interactive chips with keyboard navigation.
 *
 * Props:
 *   value    {string[]}  — current tag array (controlled)
 *   onChange {Function}  — called with new tag array on any change
 *   disabled {boolean}   — when true: no remove buttons, input disabled, reduced opacity
 */
export default function TagChipEditor({ value = [], onChange, disabled = false }) {
  const [inputValue, setInputValue] = useState('');
  const [focusedChipIndex, setFocusedChipIndex] = useState(null);

  const inputRef = useRef(null);
  const chipRefs = useRef([]);

  // Keep chipRefs array sized to current value length
  chipRefs.current = chipRefs.current.slice(0, value.length);

  // Commit the current input as a new tag (Enter or comma)
  const commitInput = useCallback(() => {
    const trimmed = inputValue.trim().replace(/,$/, '');
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setInputValue('');
      return;
    }
    onChange([...value, trimmed]);
    setInputValue('');
  }, [inputValue, value, onChange]);

  // Remove tag at index; return focus to input
  const removeTag = useCallback(
    (idx) => {
      onChange(value.filter((_, i) => i !== idx));
      setFocusedChipIndex(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [value, onChange]
  );

  // Focus a chip by index; clamp to valid range
  const focusChip = useCallback(
    (idx) => {
      const clamped = Math.max(0, Math.min(idx, value.length - 1));
      setFocusedChipIndex(clamped);
      // defer so the ref element is in DOM
      setTimeout(() => chipRefs.current[clamped]?.focus(), 0);
    },
    [value.length]
  );

  // Return focus to the text input
  const focusInput = useCallback(() => {
    setFocusedChipIndex(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Container click → always focus the text input
  function handleContainerClick(e) {
    if (disabled) return;
    // Don't steal focus away from a chip button click
    if (e.target.closest('[data-chip]')) return;
    inputRef.current?.focus();
  }

  // Keydown on the text input
  function handleInputKeyDown(e) {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitInput();
      return;
    }

    if (e.key === 'Backspace' && inputValue === '') {
      e.preventDefault();
      if (focusedChipIndex !== null) {
        removeTag(focusedChipIndex);
      } else if (value.length > 0) {
        focusChip(value.length - 1);
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      // Only intercept when cursor is at position 0
      const cursorPos = e.target.selectionStart;
      if (cursorPos === 0 && value.length > 0) {
        e.preventDefault();
        focusChip(value.length - 1);
      }
      return;
    }
  }

  // Keydown on a focused chip
  function handleChipKeyDown(e, idx) {
    if (disabled) return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      removeTag(idx);
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (idx > 0) {
        focusChip(idx - 1);
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (idx < value.length - 1) {
        focusChip(idx + 1);
      } else {
        focusInput();
      }
      return;
    }

    // Any printable character while a chip is focused → redirect to input
    if (e.key.length === 1) {
      focusInput();
    }
  }

  // Paste into input: split by comma, add all as tags
  function handlePaste(e) {
    if (disabled) return;
    const text = e.clipboardData.getData('text');
    const parts = text
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t && !value.includes(t));
    if (parts.length > 0) {
      e.preventDefault();
      onChange([...value, ...parts]);
      setInputValue('');
    }
  }

  return (
    <div
      className={`${styles.editor} ${disabled ? styles.disabled : ''}`}
      onClick={handleContainerClick}
      role="group"
      aria-label="Tags editor"
    >
      {value.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          data-chip="true"
          ref={(el) => (chipRefs.current[idx] = el)}
          className={`${styles.chip} ${focusedChipIndex === idx ? styles.chipFocused : ''}`}
          tabIndex={-1}
          onFocus={() => setFocusedChipIndex(idx)}
          onBlur={(e) => {
            // Only clear chip focus if focus moves outside editor entirely
            if (!e.currentTarget.closest('[role="group"]')?.contains(e.relatedTarget)) {
              setFocusedChipIndex(null);
            }
          }}
          onKeyDown={(e) => handleChipKeyDown(e, idx)}
          aria-label={`Tag: ${tag}`}
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              className={styles.remove}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(idx);
              }}
              tabIndex={-1}
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleInputKeyDown}
        onPaste={handlePaste}
        onFocus={() => setFocusedChipIndex(null)}
        disabled={disabled}
        placeholder={value.length === 0 ? 'Add tags…' : ''}
        aria-label="Add a tag"
      />
    </div>
  );
}
