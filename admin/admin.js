(() => {
  'use strict';

  const config = window.GOLOSOV_CMS_CONFIG;
  const supabaseLibrary = window.supabase;
  const loginView = document.querySelector('[data-login-view]');
  const adminView = document.querySelector('[data-admin-view]');
  const loginForm = document.querySelector('[data-login-form]');
  const loginMessage = document.querySelector('[data-login-message]');
  const loginSubmit = document.querySelector('[data-login-submit]');
  const logoutButton = document.querySelector('[data-logout]');
  const tabButtons = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const addCaseButton = document.querySelector('[data-add-case]');
  const caseEditor = document.querySelector('[data-case-editor]');
  const caseForm = document.querySelector('[data-case-form]');
  const caseFormTitle = document.querySelector('[data-case-form-title]');
  const caseFormMessage = document.querySelector('[data-case-form-message]');
  const saveCaseButton = document.querySelector('[data-save-case]');
  const closeEditorButton = document.querySelector('[data-close-editor]');
  const cancelCaseButton = document.querySelector('[data-cancel-case]');
  const adminCaseList = document.querySelector('[data-admin-case-list]');
  const casesState = document.querySelector('[data-cases-state]');
  const currentPhoto = document.querySelector('[data-current-photo]');
  const photoInput = document.querySelector('[data-photo-input]');
  const photoPreview = document.querySelector('[data-photo-preview]');
  const photoPreviewImage = document.querySelector('[data-photo-preview-image]');
  const photoFileName = document.querySelector('[data-photo-file-name]');
  const photoMessage = document.querySelector('[data-photo-message]');
  const uploadPhotoButton = document.querySelector('[data-upload-photo]');
  const toast = document.querySelector('[data-toast]');

  if (!config || !supabaseLibrary?.createClient) {
    if (loginMessage) loginMessage.textContent = 'Не удалось загрузить защищённый раздел. Обновите страницу.';
    return;
  }

  const client = supabaseLibrary.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  const state = {
    cases: [],
    editingId: null,
    selectedFile: null,
    previewUrl: null,
    currentPortraitPath: null,
    toastTimer: null
  };

  const setMessage = (node, message = '', success = false) => {
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-success', success);
  };

  const showToast = (message, error = false) => {
    if (!toast) return;
    window.clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.classList.toggle('is-error', error);
    toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  };

  const setButtonBusy = (button, busy, busyText, normalText) => {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? busyText : normalText;
  };

  const showLogin = (message = '') => {
    loginView.hidden = false;
    adminView.hidden = true;
    setMessage(loginMessage, message);
  };

  const showAdmin = () => {
    loginView.hidden = true;
    adminView.hidden = false;
  };

  const verifyAdmin = async (userId) => {
    const { data, error } = await client
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    return !error && data?.user_id === userId;
  };

  const activateSession = async (session) => {
    if (!session?.user?.id) {
      showLogin();
      return false;
    }

    const allowed = await verifyAdmin(session.user.id);
    if (!allowed) {
      await client.auth.signOut();
      showLogin('У этой учётной записи нет доступа к управлению сайтом.');
      return false;
    }

    showAdmin();
    await Promise.all([loadCases(), loadCurrentPhoto()]);
    return true;
  };

  const getSafeHttpsUrl = (value) => {
    try {
      const url = new URL(String(value).trim());
      return url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  };

  const normalizeCaseForm = () => {
    const formData = new FormData(caseForm);
    const caseNumber = String(formData.get('case_number') || '').trim();
    const label = String(formData.get('label') || '').trim();
    const source = String(formData.get('source') || '').trim();
    const url = getSafeHttpsUrl(formData.get('url'));
    const sortOrderValue = Number(formData.get('sort_order'));

    if (caseNumber.length < 3 || caseNumber.length > 120) {
      throw new Error('Укажите номер дела длиной от 3 до 120 символов.');
    }
    if (label.length < 3 || label.length > 180) {
      throw new Error('Заполните короткую информацию о деле.');
    }
    if (source.length < 3 || source.length > 120) {
      throw new Error('Укажите суд или источник.');
    }
    if (!url || url.length > 2048) {
      throw new Error('Укажите корректную ссылку, начинающуюся с https://');
    }
    if (!Number.isInteger(sortOrderValue) || sortOrderValue < -100000 || sortOrderValue > 100000) {
      throw new Error('Порядок должен быть целым числом от −100000 до 100000.');
    }

    return {
      case_number: caseNumber,
      label,
      source,
      url,
      sort_order: sortOrderValue,
      is_published: formData.get('is_published') === 'on'
    };
  };

  const resetCaseForm = () => {
    state.editingId = null;
    caseForm.reset();
    caseForm.elements.id.value = '';
    caseForm.elements.label.value = 'Пример судебной практики';
    caseForm.elements.source.value = 'Картотека арбитражных дел';
    caseForm.elements.sort_order.value = '100';
    caseForm.elements.is_published.checked = true;
    caseFormTitle.textContent = 'Новое дело';
    setMessage(caseFormMessage);
  };

  const openCaseEditor = (item = null) => {
    resetCaseForm();

    if (item) {
      state.editingId = item.id;
      caseForm.elements.id.value = item.id;
      caseForm.elements.case_number.value = item.case_number;
      caseForm.elements.label.value = item.label;
      caseForm.elements.source.value = item.source;
      caseForm.elements.url.value = item.url;
      caseForm.elements.sort_order.value = String(item.sort_order);
      caseForm.elements.is_published.checked = item.is_published;
      caseFormTitle.textContent = 'Редактировать дело';
    }

    caseEditor.hidden = false;
    caseForm.elements.case_number.focus({ preventScroll: true });
    caseEditor.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const closeCaseEditor = () => {
    caseEditor.hidden = true;
    resetCaseForm();
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Дата не указана'
      : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  const formatCaseTitle = (caseNumber) => /^дело\s*№/i.test(caseNumber)
    ? caseNumber
    : `Дело № ${caseNumber}`;

  const makeElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === 'string') element.textContent = text;
    return element;
  };

  const renderCases = () => {
    adminCaseList.replaceChildren();

    if (!state.cases.length) {
      casesState.textContent = 'Дел пока нет. Добавьте первую запись.';
      casesState.hidden = false;
      return;
    }

    casesState.hidden = true;
    const fragment = document.createDocumentFragment();

    state.cases.forEach((item) => {
      const card = makeElement('article', 'admin-case-card');
      const content = makeElement('div', 'case-card-content');
      const title = makeElement('h3', '', formatCaseTitle(item.case_number));
      const description = makeElement('p', '', item.label);
      const source = makeElement('p', '', item.source);
      const link = makeElement('a', '', 'Открыть карточку дела');
      const meta = makeElement('div', 'case-card-meta');
      const order = makeElement('span', '', `Порядок: ${item.sort_order}`);
      const date = makeElement('span', '', `Добавлено: ${formatDate(item.created_at)}`);
      const status = makeElement('span', `case-card-status${item.is_published ? '' : ' is-draft'}`, item.is_published ? 'Опубликовано' : 'Черновик');
      const actions = makeElement('div', 'case-card-actions');
      const edit = makeElement('button', 'admin-button admin-button-quiet', 'Редактировать');
      const remove = makeElement('button', 'admin-button admin-button-danger', 'Удалить');

      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      edit.type = 'button';
      remove.type = 'button';
      edit.addEventListener('click', () => openCaseEditor(item));
      remove.addEventListener('click', () => deleteCase(item));
      meta.append(order, date, status);
      content.append(title, description, source, link, meta);
      actions.append(edit, remove);
      card.append(content, actions);
      fragment.append(card);
    });

    adminCaseList.append(fragment);
  };

  async function loadCases() {
    casesState.hidden = false;
    casesState.textContent = 'Загружаем дела…';
    adminCaseList.replaceChildren();

    const { data, error } = await client
      .from('legal_cases')
      .select('id,case_number,label,source,url,sort_order,is_published,created_at,updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      casesState.textContent = 'Не удалось загрузить дела. Проверьте подключение и попробуйте обновить страницу.';
      showToast('Ошибка загрузки судебной практики.', true);
      return;
    }

    state.cases = Array.isArray(data) ? data : [];
    renderCases();
  }

  async function deleteCase(item) {
    const confirmed = window.confirm(`Удалить дело № ${item.case_number}? Это действие нельзя отменить.`);
    if (!confirmed) return;

    const { error } = await client.from('legal_cases').delete().eq('id', item.id);
    if (error) {
      showToast('Не удалось удалить дело. Попробуйте ещё раз.', true);
      return;
    }

    showToast('Дело удалено. Публичный сайт обновится автоматически.');
    if (state.editingId === item.id) closeCaseEditor();
    await loadCases();
  }

  const getPublicPhotoUrl = (path) => {
    if (!path || path.includes('..') || !path.startsWith(`${config.portraitFolder}/`)) return null;
    const { data } = client.storage.from(config.portraitBucket).getPublicUrl(path);
    return data?.publicUrl || null;
  };

  async function loadCurrentPhoto() {
    const { data, error } = await client
      .from('site_profile')
      .select('portrait_path,portrait_alt,updated_at')
      .eq('id', 'main')
      .maybeSingle();

    if (error || !data?.portrait_path) {
      state.currentPortraitPath = null;
      return;
    }

    const publicUrl = getPublicPhotoUrl(data.portrait_path);
    if (!publicUrl) return;
    try {
      await preloadRemoteImage(publicUrl);
      state.currentPortraitPath = data.portrait_path;
      currentPhoto.src = publicUrl;
      if (data.portrait_alt) currentPhoto.alt = data.portrait_alt;
    } catch {
      state.currentPortraitPath = null;
    }
  }

  const clearSelectedPhoto = () => {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
    state.selectedFile = null;
    photoInput.value = '';
    photoPreview.hidden = true;
    photoPreviewImage.removeAttribute('src');
    photoFileName.textContent = '';
    uploadPhotoButton.disabled = true;
    uploadPhotoButton.textContent = 'Загрузить и заменить';
  };

  const validatePhoto = (file) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!file || !file.size) throw new Error('Выберите непустой файл изображения.');
    if (!allowed.has(file.type)) throw new Error('Разрешены только JPG, PNG и WEBP.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Файл превышает допустимый размер 8 МБ.');
  };

  const loadLocalImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Файл не удалось прочитать как изображение.'));
    };
    image.src = url;
  });

  const optimizePhoto = async (file) => {
    const image = await loadLocalImage(file);
    const maxWidth = 1600;
    const maxHeight = 2400;
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) throw new Error('Браузер не смог подготовить изображение.');
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = '#eaf2f4';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Не удалось оптимизировать изображение.')),
        'image/webp',
        0.88
      );
    });
  };

  const preloadRemoteImage = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = () => reject(new Error('Загруженное изображение пока недоступно.'));
    image.src = url;
  });

  const makePhotoPath = () => {
    const id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${config.portraitFolder}/${id}.webp`;
  };

  async function uploadPhoto() {
    if (!state.selectedFile) return;
    setButtonBusy(uploadPhotoButton, true, 'Подготавливаем…', 'Загрузить и заменить');
    setMessage(photoMessage, 'Оптимизируем фотографию…', true);
    let newPath = null;

    try {
      const optimized = await optimizePhoto(state.selectedFile);
      newPath = makePhotoPath();
      setButtonBusy(uploadPhotoButton, true, 'Загружаем…', 'Загрузить и заменить');
      setMessage(photoMessage, 'Загружаем новое изображение…', true);

      const { error: uploadError } = await client.storage
        .from(config.portraitBucket)
        .upload(newPath, optimized, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: false
        });
      if (uploadError) throw uploadError;

      const publicUrl = getPublicPhotoUrl(newPath);
      if (!publicUrl) throw new Error('Не удалось получить публичный адрес изображения.');
      await preloadRemoteImage(publicUrl);

      const oldPath = state.currentPortraitPath;
      const { error: profileError } = await client
        .from('site_profile')
        .upsert({
          id: 'main',
          portrait_path: newPath,
          portrait_alt: 'Юрист Станислав Голосов'
        }, { onConflict: 'id' });

      if (profileError) {
        throw profileError;
      }

      state.currentPortraitPath = newPath;
      currentPhoto.src = publicUrl;
      setMessage(photoMessage, 'Фотография обновлена и уже доступна публичному сайту.', true);
      showToast('Фотография успешно обновлена.');
      clearSelectedPhoto();

      if (oldPath && oldPath !== newPath) {
        await client.storage.from(config.portraitBucket).remove([oldPath]);
      }
    } catch (error) {
      if (newPath && state.currentPortraitPath !== newPath) {
        await client.storage.from(config.portraitBucket).remove([newPath]);
      }
      setMessage(photoMessage, 'Не удалось заменить фотографию. Текущее фото сохранено; попробуйте ещё раз.');
      showToast('Фотография не была изменена.', true);
      uploadPhotoButton.disabled = false;
    } finally {
      if (state.selectedFile) setButtonBusy(uploadPhotoButton, false, 'Загружаем…', 'Загрузить и заменить');
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = loginForm.elements.email.value.trim();
    const password = loginForm.elements.password.value;

    if (!email || !password) {
      setMessage(loginMessage, 'Введите e-mail и пароль.');
      return;
    }

    setMessage(loginMessage);
    setButtonBusy(loginSubmit, true, 'Проверяем…', 'Войти');
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      setMessage(loginMessage, 'Не удалось войти. Проверьте e-mail и пароль.');
      setButtonBusy(loginSubmit, false, 'Проверяем…', 'Войти');
      return;
    }

    const activated = await activateSession(data.session);
    setButtonBusy(loginSubmit, false, 'Проверяем…', 'Войти');
    if (activated) loginForm.reset();
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    await client.auth.signOut();
    logoutButton.disabled = false;
    closeCaseEditor();
    clearSelectedPhoto();
    showLogin('Вы вышли из системы.');
  });

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.tab;
      tabButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.panel !== name;
      });
    });
  });

  addCaseButton.addEventListener('click', () => openCaseEditor());
  closeEditorButton.addEventListener('click', closeCaseEditor);
  cancelCaseButton.addEventListener('click', closeCaseEditor);

  caseForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(caseFormMessage);
    let payload;

    try {
      payload = normalizeCaseForm();
    } catch (error) {
      setMessage(caseFormMessage, error.message);
      return;
    }

    setButtonBusy(saveCaseButton, true, 'Сохраняем…', 'Сохранить');
    const query = state.editingId
      ? client.from('legal_cases').update(payload).eq('id', state.editingId)
      : client.from('legal_cases').insert(payload);
    const { error } = await query.select('id').single();

    if (error) {
      const duplicate = error.code === '23505';
      setMessage(caseFormMessage, duplicate
        ? 'Дело с такой ссылкой уже существует.'
        : 'Не удалось сохранить дело. Проверьте данные и попробуйте ещё раз.');
      setButtonBusy(saveCaseButton, false, 'Сохраняем…', 'Сохранить');
      return;
    }

    showToast(state.editingId ? 'Изменения сохранены.' : 'Дело добавлено.');
    closeCaseEditor();
    setButtonBusy(saveCaseButton, false, 'Сохраняем…', 'Сохранить');
    await loadCases();
  });

  photoInput.addEventListener('change', () => {
    setMessage(photoMessage);
    const file = photoInput.files?.[0];

    try {
      validatePhoto(file);
    } catch (error) {
      clearSelectedPhoto();
      setMessage(photoMessage, error.message);
      return;
    }

    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.selectedFile = file;
    state.previewUrl = URL.createObjectURL(file);
    photoPreviewImage.src = state.previewUrl;
    photoFileName.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} МБ`;
    photoPreview.hidden = false;
    uploadPhotoButton.disabled = false;
  });

  uploadPhotoButton.addEventListener('click', uploadPhoto);

  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') showLogin();
  });

  (async () => {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
      showLogin();
      return;
    }
    await activateSession(data.session);
  })();
})();
