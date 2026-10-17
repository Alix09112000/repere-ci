/* Repère Maps V2 — interactions de la carte et du panneau Explorer.
   Ne réécrit ni l'API ni le guidage de Repère CI. */
(() => {
  'use strict';
  const root = document.getElementById('scrCarte');
  const sheet = document.getElementById('feuilleBas');
  const toggle = document.getElementById('repereSheetToggle');
  const search = document.getElementById('qDest');
  const searchButton = document.getElementById('btnChercher');
  const suggest = document.getElementById('suggest');
  const guidance = document.getElementById('consigne');
  if (!root || !sheet || !toggle || !search || !searchButton || !suggest) return;

  function isCompact() {
    return window.matchMedia('(max-width: 899px)').matches;
  }
  function refreshSheetHeight() {
    const height = root.classList.contains('repere-guiding') ? 0 : sheet.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--repere-sheet-h', Math.ceil(height) + 'px');
  }
  function setCollapsed(collapsed) {
    root.classList.toggle('sheet-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Développer le panneau Explorer' : 'Réduire le panneau Explorer');
    refreshSheetHeight();
  }

  toggle.addEventListener('click', () => {
    if (!isCompact()) return;
    setCollapsed(!root.classList.contains('sheet-collapsed'));
  });

  // Préserve les raccourcis accessibles sans imposer une nouvelle recherche API :
  // les catégories réutilisent le filtre et le chargement existants de la carte.
  const quickButtons = Array.from(document.querySelectorAll('[data-repere-category]'));
  quickButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.getAttribute('data-repere-category');
      if (!category) return;
      const filterButton = Array.from(document.querySelectorAll('#scrCarte .filtres button[data-cat]'))
        .find((item) => item.dataset.cat === category);
      if (filterButton) {
        filterButton.click(); // Exécute le filtre existant, donc chargerLieux().
        quickButtons.forEach((item) => item.classList.toggle(
          'is-selected', item === button && category !== ''
        ));
        if (isCompact()) setCollapsed(true); // Laisse voir les résultats sur la carte.
      } else {
        search.value = category;
        search.dispatchEvent(new Event('input', { bubbles: true }));
        searchButton.click();
        search.focus({ preventScroll: true });
      }
    });
  });

  // Si l'utilisateur change de filtre via la rangée de la carte,
  // l'état visuel du panneau reste synchronisé.
  const filters = root.querySelector('.filtres');
  if (filters) filters.addEventListener('click', (event) => {
    const b = event.target.closest('button[data-cat]');
    if (!b) return;
    quickButtons.forEach((item) => item.classList.toggle(
      'is-selected', item.dataset.repereCategory === b.dataset.cat && b.dataset.cat !== ''
    ));
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

  // Le grand panneau ne doit jamais masquer les instructions GPS.
  function refreshGuidance() {
    root.classList.toggle('repere-guiding', !!guidance && guidance.classList.contains('on'));
    refreshSheetHeight();
  }
  if (guidance) new MutationObserver(refreshGuidance).observe(guidance, {
    attributes: true, attributeFilter: ['class']
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(refreshSheetHeight).observe(sheet);
  }
  window.addEventListener('resize', () => {
    refreshSheetHeight();
    if (typeof map !== 'undefined') map.invalidateSize();
  });
  refreshGuidance();
  refreshSheetHeight();
})();
