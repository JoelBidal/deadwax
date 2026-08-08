import styles from './AddSlot.module.css';

export default function AddSlot({ onOpen }: { onOpen: () => void }) {
  return (
    <li className={styles.cell}>
      <button type="button" className={styles.button} onClick={onOpen}>
        <span className={styles.disc} aria-hidden="true" />
        <span className={styles.sleeve} aria-hidden="true" />
        <span className={styles.label}>Add a record</span>
      </button>
    </li>
  );
}
