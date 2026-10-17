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
  const clearSearch = document.getElementById('btnClearSearch');
  const guidance = document.getElementById('consigne');
  const coverageNote = document.getElementById('repereCoverageNote');
  const returnAbidjan = document.getElementById('repereReturnAbidjan');
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
        // Toucher à nouveau une catégorie sélectionnée revient à « Tout ».
        const alreadySelected = filterButton.classList.contains('acc');
        const all = root.querySelector('.filtres button[data-cat=""]');
        (alreadySelected && all ? all : filterButton).click();
        quickButtons.forEach((item) => item.classList.toggle(
          'is-selected', !alreadySelected && item === button && category !== ''
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

  // Les tuiles OSM restent accessibles partout ; seuls les repères
  // communautaires Repère CI sont disponibles en Côte d'Ivoire.
  function updateCoverage() {
    if (!coverageNote || typeof map === 'undefined' || typeof CI === 'undefined') return;
    const point = map.getCenter();
    const inside = point.lat >= CI.latMin && point.lat <= CI.latMax &&
                   point.lng >= CI.lngMin && point.lng <= CI.lngMax;
    coverageNote.hidden = inside;
    refreshSheetHeight();
  }
  if (typeof map !== 'undefined') map.on('moveend', updateCoverage);
  if (returnAbidjan) {
    returnAbidjan.addEventListener('click', () => {
      const all = root.querySelector('.filtres button[data-cat=""]');
      if (all && !all.classList.contains('acc')) all.click();
      if (typeof map !== 'undefined' && typeof ABIDJAN !== 'undefined') {
        map.setView([ABIDJAN.lat, ABIDJAN.lng], 14, { animate: false });
      }
      if (isCompact()) setCollapsed(false);
      updateCoverage();
    });
  }

  // Bouton effacer toujours synchronisé avec la saisie.
  function syncClearSearch() {
    if (clearSearch) clearSearch.hidden = !search.value.length;
  }
  search.addEventListener('input', syncClearSearch);
  if (clearSearch) clearSearch.addEventListener('click', () => {
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.focus();
    syncClearSearch();
  });
  syncClearSearch();

  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (typeof annulerRecherche === 'function') annulerRecherche();
    else suggest.classList.remove('on');
    search.blur();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.chercher, .suggest, .repere-quick-actions')) {
      if (typeof annulerRecherche === 'function') annulerRecherche();
      else suggest.classList.remove('on');
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
  updateCoverage();
  refreshSheetHeight();
})();
