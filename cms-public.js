(() => {
  'use strict';

  const config = window.GOLOSOV_CMS_CONFIG;
  const caseList = document.querySelector('[data-case-list]');
  const moreButton = document.querySelector('[data-case-more]');
  const caseStatus = document.querySelector('[data-case-status]');
  const portrait = document.querySelector('[data-cms-portrait]');
  const portraitSource = document.querySelector('[data-cms-portrait-source]');
  const priceList = document.querySelector('[data-price-list]');
  const bankruptcyPrice = document.querySelector('[data-bankruptcy-price]');

  if (!config || !config.supabaseUrl || !config.supabasePublishableKey) return;

  const pageSize = Number.isInteger(config.casesPageSize) && config.casesPageSize > 0
    ? config.casesPageSize
    : 4;
  const apiBase = `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1`;
  const fallbackRows = caseList ? [...caseList.querySelectorAll('.case-row')] : [];
  let mode = 'fallback';
  let loadedCount = Math.min(pageSize, fallbackRows.length);
  let totalCount = fallbackRows.length;
  let hasMore = loadedCount < totalCount;
  let loading = false;

  const setStatus = (message = '', visible = false) => {
    if (!caseStatus) return;
    caseStatus.textContent = message;
    caseStatus.hidden = !visible || !message;
  };

  const updateMoreButton = () => {
    if (!moreButton) return;
    moreButton.hidden = !hasMore;
    moreButton.disabled = loading;
    moreButton.textContent = loading ? 'Загружаем…' : 'Показать ещё';
  };

  const setupFallback = () => {
    fallbackRows.forEach((row, index) => {
      row.hidden = index >= pageSize;
    });
    updateMoreButton();
  };

  const getSafeHttpsUrl = (value) => {
    try {
      const url = new URL(String(value));
      return url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  };

  const requestJson = async (path, { count = false, timeout = 8000 } = {}) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${apiBase}/${path}`, {
        headers: {
          apikey: config.supabasePublishableKey,
          ...(count ? { Prefer: 'count=exact' } : {})
        },
        signal: controller.signal
      });

      if (!response.ok) throw new Error('Content request failed');
      const data = await response.json();
      const range = response.headers.get('content-range') || '';
      const totalMatch = range.match(/\/(\d+)$/);

      return {
        data,
        total: totalMatch ? Number(totalMatch[1]) : null
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const normalizeCase = (item) => {
    if (!item || typeof item !== 'object') return null;
    const caseNumber = String(item.case_number || '').trim();
    const label = String(item.label || '').trim();
    const source = String(item.source || '').trim();
    const url = getSafeHttpsUrl(item.url);

    if (!caseNumber || !label || !source || !url) return null;
    return { caseNumber, label, source, url };
  };

  const createArrow = () => {
    const arrow = document.createElement('span');
    arrow.className = 'arrow-icon arrow-icon--external';
    arrow.setAttribute('aria-hidden', 'true');
    return arrow;
  };

  const createCaseRow = (item, index, total) => {
    const row = document.createElement('a');
    const caseIndex = document.createElement('span');
    const title = document.createElement('strong');
    const meta = document.createElement('span');
    const label = document.createElement('b');
    const source = document.createElement('small');
    const action = document.createElement('i');
    const ordinal = String(index + 1).padStart(2, '0');
    const totalLabel = Number.isInteger(total) ? ` / ${String(total).padStart(2, '0')}` : '';

    row.className = 'case-row';
    row.href = item.url;
    row.target = '_blank';
    row.rel = 'noopener noreferrer';
    row.dataset.reveal = 'case';
    row.style.transitionDelay = `${Math.min((index % pageSize) * 70, 210)}ms`;

    caseIndex.className = 'case-index';
    caseIndex.textContent = `${ordinal}${totalLabel}`;
    title.textContent = /^дело\s*№/i.test(item.caseNumber)
      ? item.caseNumber
      : `Дело № ${item.caseNumber}`;
    meta.className = 'case-meta';
    label.textContent = item.label;
    source.textContent = item.source;
    action.append('Открыть карточку дела ', createArrow());
    meta.append(label, source);
    row.append(caseIndex, title, meta, action);

    return row;
  };

  const revealRows = (rows) => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      rows.forEach((row) => row.classList.add('is-visible'));
      return;
    }
    window.requestAnimationFrame(() => rows.forEach((row) => row.classList.add('is-visible')));
  };

  const fetchCases = async (offset) => {
    const select = 'id,case_number,label,source,url';
    const query = `legal_cases?select=${select}&is_published=eq.true&order=sort_order.asc,created_at.desc&offset=${offset}&limit=${pageSize + 1}`;
    const result = await requestJson(query, { count: true });
    const normalized = Array.isArray(result.data)
      ? result.data.map(normalizeCase).filter(Boolean)
      : [];
    const total = Number.isInteger(result.total) ? result.total : null;

    return {
      cases: normalized.slice(0, pageSize),
      total,
      hasMore: total === null
        ? normalized.length > pageSize
        : offset + pageSize < total
    };
  };

  const loadFirstPage = async () => {
    if (!caseList) return;
    caseList.setAttribute('aria-busy', 'true');

    try {
      const result = await fetchCases(0);
      const rows = result.cases.map((item, index) => createCaseRow(item, index, result.total));

      caseList.replaceChildren(...rows);
      mode = 'remote';
      loadedCount = rows.length;
      totalCount = result.total ?? rows.length;
      hasMore = result.hasMore;
      revealRows(rows);
      setStatus(result.total === 0 ? 'Опубликованные дела временно отсутствуют.' : '', result.total === 0);
      updateMoreButton();
    } catch {
      mode = 'fallback';
      loadedCount = Math.min(pageSize, fallbackRows.length);
      totalCount = fallbackRows.length;
      hasMore = loadedCount < totalCount;
      setupFallback();
    } finally {
      caseList.removeAttribute('aria-busy');
    }
  };

  const showMoreFallback = () => {
    const nextCount = Math.min(loadedCount + pageSize, fallbackRows.length);
    fallbackRows.slice(loadedCount, nextCount).forEach((row) => {
      row.hidden = false;
      row.classList.add('is-visible');
    });
    loadedCount = nextCount;
    hasMore = loadedCount < fallbackRows.length;
    updateMoreButton();
  };

  const loadMoreRemote = async () => {
    if (!caseList || loading) return;
    loading = true;
    setStatus('Загружаем следующую часть судебной практики…', true);
    updateMoreButton();

    try {
      const result = await fetchCases(loadedCount);
      const rows = result.cases.map((item, index) => createCaseRow(item, loadedCount + index, result.total));
      caseList.append(...rows);
      loadedCount += rows.length;
      totalCount = result.total ?? loadedCount;
      hasMore = result.hasMore;
      revealRows(rows);
      setStatus();
    } catch {
      setStatus('Сейчас не удалось загрузить следующую часть. Попробуйте ещё раз.', true);
    } finally {
      loading = false;
      updateMoreButton();
    }
  };

  const loadPortrait = async () => {
    if (!portrait || !config.portraitBucket || !config.portraitFolder) return;

    try {
      const result = await requestJson('site_profile?select=portrait_path,portrait_alt,updated_at&id=eq.main&limit=1');
      const profile = Array.isArray(result.data) ? result.data[0] : null;
      const path = String(profile?.portrait_path || '').trim();
      const expectedPrefix = `${config.portraitFolder}/`;

      if (!path.startsWith(expectedPrefix) || path.includes('..')) return;
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const imageUrl = `${config.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(config.portraitBucket)}/${encodedPath}`;
      const candidate = new Image();

      candidate.onload = () => {
        if (portraitSource) portraitSource.srcset = imageUrl;
        portrait.src = imageUrl;
        if (profile.portrait_alt) portrait.alt = String(profile.portrait_alt).slice(0, 160);
      };
      candidate.src = imageUrl;
    } catch {
      // The local portrait remains in place when Supabase or Storage is unavailable.
    }
  };

  const normalizePriceItem = (item) => {
    if (!item || typeof item !== 'object') return null;
    const title = String(item.title || '').trim();
    const price = String(item.price || '').trim();

    if (!title || title.length > 160 || !price || price.length > 80) return null;
    return {
      title,
      price: price.replace(/\s+₽/g, '\u00a0₽'),
      isFeatured: item.is_featured === true
    };
  };

  const createPriceRow = (item, index) => {
    const row = document.createElement('li');
    const ordinal = document.createElement('span');
    const title = document.createElement('h3');
    const price = document.createElement('strong');

    if (item.isFeatured) row.classList.add('price-main');
    row.dataset.reveal = 'price-row';
    row.classList.add('is-visible');
    ordinal.textContent = String(index + 1).padStart(2, '0');
    title.textContent = item.title;
    price.textContent = item.price;
    row.append(ordinal, title, price);
    return row;
  };

  const loadPriceList = async () => {
    if (!priceList) return;
    priceList.setAttribute('aria-busy', 'true');

    try {
      const select = 'id,title,price,sort_order,is_featured';
      const result = await requestJson(`price_items?select=${select}&is_published=eq.true&order=sort_order.asc,created_at.asc`);
      if (!Array.isArray(result.data)) throw new Error('Invalid price response');
      const items = result.data.map(normalizePriceItem).filter(Boolean);
      if (items.length !== result.data.length) throw new Error('Invalid price item');
      priceList.replaceChildren(...items.map(createPriceRow));

      const bankruptcyItem = items.find((item) => item.title.toLocaleLowerCase('ru') === 'банкротство физических лиц')
        || items.find((item) => item.isFeatured && /банкротств.*физическ/i.test(item.title));
      if (bankruptcyPrice && bankruptcyItem) bankruptcyPrice.textContent = bankruptcyItem.price;
    } catch {
      // The original HTML price list remains visible when the API is unavailable.
    } finally {
      priceList.removeAttribute('aria-busy');
    }
  };

  if (caseList && moreButton) {
    setupFallback();
    moreButton.addEventListener('click', () => {
      if (mode === 'remote') loadMoreRemote();
      else showMoreFallback();
    });
    loadFirstPage();
  }

  loadPortrait();
  loadPriceList();
})();
