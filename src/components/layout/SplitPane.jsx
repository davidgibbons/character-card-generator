import { Group, Panel, Separator } from 'react-resizable-panels';
import styles from './SplitPane.module.css';

export default function SplitPane({ leftContent, rightContent }) {
  return (
    <div className={styles.wrapper}>
      <Group direction="horizontal" autoSaveId="main-split">
        <Panel defaultSize={50} minSize={20}>
          <div className={styles.panel}>
            {leftContent}
          </div>
        </Panel>
        <Separator className={styles.handle} />
        <Panel defaultSize={50} minSize={20}>
          <div className={styles.panel}>
            {rightContent}
          </div>
        </Panel>
      </Group>
    </div>
  );
}
