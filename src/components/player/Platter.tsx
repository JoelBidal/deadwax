import styles from './Platter.module.css';

type Props = {
  coverUrl: string;
  spinning: boolean;
};

export default function Platter({ coverUrl, spinning }: Props) {
  return (
    <div className={styles.platter}>
      <div className={`${styles.vinyl} ${spinning ? styles.spinning : ''}`}>
        <div className={styles.label}>
          <img src={coverUrl} alt="" width={600} height={600} draggable={false} />
        </div>
      </div>
      <div className={styles.sheen} aria-hidden="true" />
      <div className={styles.spindle} aria-hidden="true" />
    </div>
  );
}
