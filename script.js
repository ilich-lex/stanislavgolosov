(() => {
  const root = document.documentElement;
  const body = document.body;
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-toggle]');
  const navigation = document.querySelector('[data-nav]');
  const progress = document.querySelector('.scroll-progress span');
  const portrait = document.querySelector('[data-portrait] img');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let menuScrollPosition = 0;

  const lockPageScroll = () => {
    menuScrollPosition = window.scrollY;
    body.style.top = `-${menuScrollPosition}px`;
    body.classList.add('menu-open');
  };

  const unlockPageScroll = () => {
    if (!body.classList.contains('menu-open')) return;
    root.classList.add('scroll-restore');
    body.classList.remove('menu-open');
    body.style.removeProperty('top');
    window.scrollTo(0, menuScrollPosition);
    root.classList.remove('scroll-restore');
  };

  const closeMenu = (restoreFocus = false) => {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    unlockPageScroll();
    if (restoreFocus) menuButton.focus();
  };

  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeMenu();
        return;
      }

      menuButton.setAttribute('aria-expanded', 'true');
      navigation.classList.add('is-open');
      lockPageScroll();
    });

    navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', (event) => {
      const selector = link.getAttribute('href');
      const target = selector ? document.querySelector(selector) : null;
      if (!target) {
        closeMenu();
        return;
      }

      event.preventDefault();
      closeMenu();
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
        if (window.location.hash !== selector) window.history.pushState(null, '', selector);
      });
    }));

    document.addEventListener('keydown', (event) => {
      if (menuButton.getAttribute('aria-expanded') !== 'true') return;

      if (event.key === 'Escape') {
        closeMenu(true);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = [menuButton, ...navigation.querySelectorAll('a')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const metrikaGoalsByHost = new Map([
    ['max.ru', 'click_max'],
    ['wa.me', 'click_whatsapp'],
    ['api.whatsapp.com', 'click_whatsapp'],
    ['whatsapp.com', 'click_whatsapp'],
    ['www.whatsapp.com', 'click_whatsapp'],
    ['t.me', 'click_telegram'],
    ['telegram.me', 'click_telegram'],
    ['telegram.org', 'click_telegram'],
    ['www.telegram.org', 'click_telegram'],
  ]);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    let goalName = href.toLowerCase().startsWith('tel:') ? 'click_phone' : null;
    if (!goalName) {
      try {
        goalName = metrikaGoalsByHost.get(new URL(href, window.location.href).hostname.toLowerCase()) || null;
      } catch {
        return;
      }
    }

    if (goalName && typeof window.ym === 'function') {
      window.ym(112151127, 'reachGoal', goalName);
    }
  });

  document.querySelectorAll('.faq-list summary').forEach((summary) => {
    const toggleDetails = (event) => {
      event.preventDefault();
      const details = summary.closest('details');
      if (details) details.open = !details.open;
    };

    summary.addEventListener('click', toggleDetails);
    summary.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') toggleDetails(event);
    });
  });

  const revealItems = [...document.querySelectorAll('[data-reveal]')];
  const revealInViewport = () => {
    revealItems.forEach((item) => {
      if (item.classList.contains('is-visible')) return;
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.94 && rect.bottom > 0) {
        item.classList.add('is-visible');
      }
    });
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      target.querySelectorAll('[data-reveal]').forEach((item) => item.classList.add('is-visible'));
    });
  });

  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    root.classList.add('reveal-ready');

    const heroReveals = revealItems.filter((item) => item.closest('.hero'));
    window.requestAnimationFrame(() => {
      heroReveals.forEach((item, index) => {
        window.setTimeout(() => item.classList.add('is-visible'), 90 + index * 90);
      });
    });

    const groups = new Map();
    revealItems.forEach((item) => {
      const parent = item.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(item);
    });
    groups.forEach((items) => items.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
    }));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealItems.filter((item) => !item.closest('.hero')).forEach((item) => observer.observe(item));
    window.requestAnimationFrame(revealInViewport);
    window.setTimeout(revealInViewport, 300);
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  let ticking = false;
  const updateScrollEffects = () => {
    const scrollTop = window.scrollY;
    const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);

    if (header) header.classList.toggle('is-scrolled', scrollTop > 12);
    if (progress) progress.style.transform = `scaleX(${Math.min(scrollTop / scrollable, 1)})`;

    if (portrait && !reducedMotion.matches && window.innerWidth > 767) {
      const offset = Math.min(scrollTop * 0.035, 24);
      portrait.style.transform = `scale(1.025) translate3d(0, ${offset}px, 0)`;
    }
    revealInViewport();
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateScrollEffects);
  }, { passive: true });

  updateScrollEffects();
})();
