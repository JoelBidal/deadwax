import type { MouseEvent } from 'react';

/**
 * Vuelve a la estantería sin recargar. Sigue siendo un `<a href="/">` de verdad
 * para que el botón del medio y cmd+click abran una pestaña, y para que el
 * navegador muestre el destino en la barra de estado; sólo se intercepta el
 * click común, que es el que cortaría la música.
 */
export const softHome =
  (go: () => void) =>
  (e: MouseEvent<HTMLAnchorElement>): void => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    go();
  };
