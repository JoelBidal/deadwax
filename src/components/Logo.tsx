/**
 * El isotipo solo, sin la palabra. Vive acá y no copiado en cada pantalla
 * porque ya aparece en tres lugares y el `fill` tiene que seguir al tema en
 * todos: `currentColor` lo resuelve, pero sólo si el dibujo es uno solo.
 */
export function Mark() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 20H0V0H20V20ZM10.0015 2.30769C5.75319 2.30769 2.30919 5.75169 2.30919 10C2.30919 14.2483 5.75319 17.6923 10.0015 17.6923C14.2498 17.6923 17.6938 14.2483 17.6938 10C17.6938 5.75169 14.2498 2.30769 10.0015 2.30769Z"
        fill="currentColor"
      />
      <path
        d="M10.7707 10C10.7707 10.4248 10.4263 10.7692 10.0015 10.7692C9.57667 10.7692 9.23227 10.4248 9.23227 10C9.23227 9.57517 9.57667 9.23077 10.0015 9.23077C10.4263 9.23077 10.7707 9.57517 10.7707 10Z"
        fill="currentColor"
      />
    </svg>
  );
}
