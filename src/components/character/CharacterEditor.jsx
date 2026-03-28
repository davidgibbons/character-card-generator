import FieldRow from './FieldRow';
import EvalFeedback from './EvalFeedback';
import useGenerationStore from '../../stores/useGenerationStore';
import styles from './CharacterEditor.module.css';

const FIELD_ORDER = [
  'name', 'personality', 'description', 'scenario', 'firstMessage',
  'tags', 'mesExample', 'systemPrompt', 'creatorNotes',
];

const FIELD_LABELS = {
  name: 'Name',
  personality: 'Personality',
  description: 'Description',
  scenario: 'Scenario',
  firstMessage: 'First Message',
  tags: 'Tags',
  mesExample: 'Message Example',
  systemPrompt: 'System Prompt',
  creatorNotes: 'Creator Notes',
};

// Single-value fields get smaller min-height (80px vs 120px)
const SINGLE_VALUE_FIELDS = new Set(['name', 'tags']);

export default function CharacterEditor() {
  const character = useGenerationStore((s) => s.character);
  const updateField = useGenerationStore((s) => s.updateField);
  const evalFeedback = useGenerationStore((s) => s.evalFeedback);

  if (!character) {
    return (
      <div className={styles.emptyState}>
        <h3 className={styles.emptyHeading}>No character yet</h3>
        <p className={styles.emptyBody}>
          Enter a concept on the left and click Generate Character to create your first character.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      <div className={styles.fieldList}>
        {FIELD_ORDER.map((fieldKey) => (
          <FieldRow
            key={fieldKey}
            fieldKey={fieldKey}
            label={FIELD_LABELS[fieldKey]}
            value={character[fieldKey] ?? ''}
            onChange={updateField}
            isProseField={!SINGLE_VALUE_FIELDS.has(fieldKey)}
          />
        ))}
      </div>

      {evalFeedback && (
        <div className={styles.evalSeparator}>
          <EvalFeedback />
        </div>
      )}
    </div>
  );
}
