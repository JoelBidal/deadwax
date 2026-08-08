import { useEffect } from 'react';
import styles from './About.module.css';

export default function About({ onClose }: { onClose: () => void }) {
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
          <span className={styles.name}>
            <span className="visually-hidden">deadwax</span>
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M20 20H0V0H20V20ZM10.0015 2.30769C5.75319 2.30769 2.30919 5.75169 2.30919 10C2.30919 14.2483 5.75319 17.6923 10.0015 17.6923C14.2498 17.6923 17.6938 14.2483 17.6938 10C17.6938 5.75169 14.2498 2.30769 10.0015 2.30769Z" fill="currentColor"/>
              <path d="M10.7707 10C10.7707 10.4248 10.4263 10.7692 10.0015 10.7692C9.57667 10.7692 9.23227 10.4248 9.23227 10C9.23227 9.57517 9.57667 9.23077 10.0015 9.23077C10.4263 9.23077 10.7707 9.57517 10.7707 10Z" fill="currentColor"/>
            </svg>
          </span>
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
            <span>Astro, React, TypeScript, GSAP, Web Audio, plain CSS</span>
          </p>
          <p className={styles.row}>
            <span className={styles.key}>Your shelf</span>
            <span>Kept in your browser. Nothing is uploaded, there are no accounts.</span>
          </p>
          <p className={styles.row}>
            <span className={styles.key}>Keys</span>
            <span>Space to play or pause, Escape to go back</span>
          </p>
        </div>
      </div>
    </div>
  );
}
