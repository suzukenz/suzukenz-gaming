function setupOutline(root: HTMLElement) {
  const disclosureElement = root.querySelector('details');
  const navElement = root.querySelector<HTMLElement>('.outline-nav');
  if (!disclosureElement || !navElement) return;
  const disclosure = disclosureElement;
  const nav = navElement;

  const entries = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
    .map((link) => ({
      link,
      target: document.getElementById(decodeURIComponent(link.hash.slice(1))),
    }))
    .filter(
      (entry): entry is { link: HTMLAnchorElement; target: HTMLElement } =>
        entry.target !== null,
    );
  if (entries.length === 0) return;

  for (const { target } of entries) target.tabIndex = -1;

  const desktop = matchMedia('(min-width: 64rem)');
  const nativeScrollspy =
    CSS.supports('scroll-target-group: auto') &&
    CSS.supports('selector(:target-current)');
  nav.dataset.scrollspy = nativeScrollspy ? 'native' : 'fallback';

  function setCurrent(current: HTMLAnchorElement | null) {
    for (const { link } of entries) {
      if (link === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
      link.classList.toggle('is-current', !nativeScrollspy && link === current);
    }
  }

  function anchorOffset() {
    return parseFloat(
      getComputedStyle(entries[0].target).scrollMarginBlockStart,
    );
  }

  function updateCurrent() {
    if (nativeScrollspy) {
      const current = nav.querySelector<HTMLAnchorElement>('a:target-current');
      if (current) {
        setCurrent(current);
        return;
      }
    }

    let current = entries[0];
    const offset = anchorOffset() + 1;
    for (const entry of entries) {
      if (entry.target.getBoundingClientRect().top > offset) break;
      current = entry;
    }
    if (
      scrollY > 0 &&
      Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight
    ) {
      current = entries[entries.length - 1];
    }
    setCurrent(current.link);
  }

  let observer: IntersectionObserver | undefined;
  function queueUpdate() {
    requestAnimationFrame(updateCurrent);
  }

  function updateMode() {
    disclosure.open = desktop.matches;
    if (!nativeScrollspy) {
      observer?.disconnect();
      observer = new IntersectionObserver(updateCurrent, {
        rootMargin: `-${anchorOffset()}px 0px -50% 0px`,
      });
      for (const { target } of entries) observer.observe(target);
    }
    queueUpdate();
  }

  nav.addEventListener('click', (event) => {
    if (
      !desktop.matches &&
      event.target instanceof Element &&
      event.target.closest('a')
    ) {
      disclosure.open = false;
    }
  });
  disclosure.addEventListener('toggle', queueUpdate);
  desktop.addEventListener('change', updateMode);
  document.addEventListener('scrollend', updateCurrent);
  window.addEventListener('hashchange', queueUpdate);
  window.addEventListener('resize', queueUpdate);
  updateMode();
}

const outline = document.querySelector<HTMLElement>('[data-article-outline]');
if (outline) setupOutline(outline);
