import { useEffect } from 'react';
import { softHome } from '../lib/nav';
import { Mark } from './Logo';
import styles from './About.module.css';

export default function About({
  onClose,
  onHome,
}: {
  onClose: () => void;
  onHome: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.stage} role="dialog" aria-modal="true" aria-label="About deadwax">
      <div className={styles.panel}>
        <div className={styles.head}>
          <a className={styles.name} href="/" onClick={softHome(onHome)}>
            <span className="visually-hidden">deadwax</span>
            <Mark />
          </a>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.body}>
          <p>
            An experiment about the part of listening that streaming removed: walking to a shelf,
            pulling a sleeve out, sliding the record onto the platter and lowering the needle. The
            music is the same. The minute before it is not.
          </p>
          <p>
            Everything you see is DOM and CSS: the grooves, the platter, the tonearm that tracks
            inward as the song plays, the dust under the needle. There is no 3D engine and no video.
            The record turns at <strong>33⅓ RPM</strong>, which is one revolution every 1.8 seconds,
            because that is how fast the real thing turns.
          </p>
          <p>
            <strong>Each track plays for 30 seconds.</strong> Not a design choice. Full albums
            require licensing deals that a personal experiment cannot have. What you hear is the
            official preview Apple publishes for every song in its catalogue, used the way it was
            meant to be used. The tracklist shows each song&apos;s real length so the difference is
            never hidden, and every record links out to the full thing.
          </p>
          <p>
            Build a shelf of your own, then share it. The link carries the records, so whoever opens
            it walks into the room you arranged.
          </p>
        </div>

        <div className={styles.meta}>
          <p className={styles.row}>
            <span className={styles.key}>Catalogue</span>
            <span>iTunes Search API</span>
          </p>
          <p className={styles.row}>
            <span className={styles.key}>Built with</span>
            <span>Astro, React, TypeScript, GSAP, Web Audio, CSS and Claude Code</span>
          </p>
          <p className={styles.row}>
            <span className={styles.key}>Your shelf</span>
            <span>Kept in your browser. Nothing is uploaded, there are no accounts.</span>
          </p>
          <p className={styles.row}>
            <span className={styles.key}>Keys</span>
            <span>Space to play or pause, Escape to go back</span>
          </p>
          <p className={styles.row}>
            <span className={styles.key}>Made by</span>
            <span>
              Joel Bidal, web developer and music lover. {' '}
              <a
                className={styles.out}
                href="https://x.com/JoelBidal5"
                target="_blank"
                rel="noreferrer"
              >
                @joelbidal5
              </a>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
