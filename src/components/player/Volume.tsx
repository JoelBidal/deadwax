import styles from './Volume.module.css';

type Props = {
  value: number;
  onChange: (value: number) => void;
};

/**
 * Un `input[type=range]` de verdad y no una barra hecha a mano: trae teclado,
 * arrastre y anuncio de lector de pantalla sin escribir nada. Lo único propio
 * es cómo se ve. `--fill` pinta lo recorrido, que el input no expone en CSS.
 */
export default function Volume({ value, onChange }: Props) {
  return (
    <span className={styles.wrap}>
      <input
        type="range"
        className={styles.range}
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Volume"
        aria-valuetext={`${Math.round(value * 100)} percent`}
        style={{ '--fill': `${value * 100}%` } as React.CSSProperties}
      />
    </span>
  );
}
