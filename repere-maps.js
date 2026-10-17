/* Repère Maps — interactions progressives, sans modifier le moteur historique. */
(() => {
  'use strict';
  const search = document.getElementById('qDest');
  const run = document.getElementById('btnChercher');
  const suggest = document.getElementById('suggest');
  if (!search || !run || !suggest) return;
  document.querySelectorAll('[data-repere-search]').forEach((button) => {
    button.addEventListener('click', () => {
      const term = button.getAttribute('data-repere-search');
      if (!term) return;
      search.value = term;
      search.dispatchEvent(new Event('input', { bubbles: true }));
      // Recherche immédiate, sans dépendre du délai de suggestion.
      run.click();
      search.focus({ preventScroll: true });
    });
  });
  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    suggest.classList.remove('on');
    search.blur();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.chercher, .suggest, .repere-quick-actions')) {
      suggest.classList.remove('on');
    }
  });
})();
