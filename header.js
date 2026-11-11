(() => {
  const header = document.querySelector('.site-header');
  const menu = document.getElementById('site-menu');
  const toggle = header.querySelector('.site-header__burger');
  const desktop = matchMedia('(min-width: 1200px)');
  const dropdowns = [...document.querySelectorAll('.site-header__dropdown')];
  const closeDropdowns = (except) => dropdowns.forEach(item => {
    if (item !== except) item.open = false;
  });

  document.querySelectorAll('.site-header__brand img').forEach(img => {
    const fallback = () => img.setAttribute('data-failed', '');
    img.addEventListener('error', fallback);
    if (img.complete && !img.naturalWidth) fallback();
  });
  toggle.addEventListener('click', () => {
    closeDropdowns();
    menu.showModal();
    toggle.setAttribute('aria-expanded', 'true');
  });
  menu.querySelector('.site-menu__close').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => {
    toggle.setAttribute('aria-expanded', 'false');
    closeDropdowns();
  });
  menu.addEventListener('click', event => {
    const rect = menu.getBoundingClientRect();
    if (event.target === menu && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) menu.close();
    if (event.target.closest('a')) menu.close();
  });
  dropdowns.forEach(item => {
    item.querySelector('summary').addEventListener('click', () => closeDropdowns(item));
    item.addEventListener('pointerenter', event => {
      if (desktop.matches && event.pointerType === 'mouse' && header.contains(item)) {
        closeDropdowns(item);
        item.open = true;
      }
    });
    item.addEventListener('pointerleave', () => {
      if (desktop.matches && !item.contains(document.activeElement)) item.open = false;
    });
    item.addEventListener('focusout', event => {
      if (!item.contains(event.relatedTarget)) item.open = false;
    });
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header__dropdown')) closeDropdowns();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const active = dropdowns.find(item => item.open && item.contains(document.activeElement));
    if (active) active.querySelector('summary').focus();
    closeDropdowns();
  });
  desktop.addEventListener('change', () => {
    closeDropdowns();
    if (desktop.matches && menu.open) menu.close();
  });
})();
