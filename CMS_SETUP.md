# Настройка CMS для golosovsv.ru

CMS остаётся частью статического GitHub Pages, а данные и фотография хранятся в Supabase. Публичный сайт не содержит ссылок на `/admin/`.

## 1. Что допустимо хранить во frontend

В `cms-config.js` находятся только:

- Supabase Project URL;
- publishable key;
- публичные настройки пагинации и Storage bucket.

Publishable key не является секретом: безопасность обеспечивают RLS policies. Никогда не добавляйте в проект `service_role`, secret key, database password или пароль администратора.

## 2. Подготовка Auth

До запуска SQL-миграции убедитесь, что в `Authentication → Users` существует пользователь Станислава с UUID:

`ce3ec75a-4f08-40bc-9bcc-0d63571c5dc4`

В настройках Auth:

1. Отключите самостоятельную регистрацию новых пользователей.
2. Установите Site URL: `https://golosovsv.ru`.
3. Добавьте Redirect URL: `https://golosovsv.ru/admin/**`.
4. Пароль хранится только у Станислава и в Supabase Auth.

## 3. Применение SQL

1. Откройте `Supabase Dashboard → SQL Editor`.
2. Создайте новый запрос.
3. Скопируйте весь файл `supabase/001_cms_schema.sql`.
4. Нажмите `Run`.
5. Убедитесь, что появились таблицы `admin_users`, `legal_cases`, `site_profile`.
6. В `legal_cases` должны появиться пять исходных дел.
7. В `admin_users` должен быть ровно один UUID Станислава.

Миграция включает RLS, whitelist, ограничения длины и URL, отдельные policies для чтения/добавления/изменения/удаления и Storage policies.

## 4. Создание Storage bucket

Откройте `Storage → New bucket` и задайте:

- Name: `site-assets`;
- Public bucket: включено;
- Maximum file size: `8 MB`;
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.

Не создавайте открытую policy для загрузки. Чтение публичного portrait разрешает сам public bucket, а INSERT/DELETE уже ограничены SQL-policy и whitelist администратора.

## 5. Локальная проверка

Запускайте сайт через локальный HTTP-сервер, а не `file://`:

```powershell
python -m http.server 4173
```

Адреса:

- публичный сайт: `http://127.0.0.1:4173/`;
- админка: `http://127.0.0.1:4173/admin/`.

После применения SQL проверьте:

1. Публичная страница показывает первые 4 дела.
2. Кнопка «Показать ещё» открывает следующую порцию.
3. Неверный логин не открывает управление.
4. Пользователь вне `admin_users` не получает доступ.
5. Станислав входит, добавляет, редактирует и удаляет тестовое дело.
6. Неавторизованный POST/DELETE к REST API отклоняется RLS.
7. JPG/PNG/WEBP загружается, оптимизируется и появляется на публичном сайте.
8. Файл другого типа и файл более 8 МБ отклоняются.
9. После выхода редактирование снова недоступно.

## 6. Публикация на GitHub Pages

Production не публикуется автоматически этой доработкой.

После локального подтверждения перенесите в репозиторий сайта:

- обновлённые `index.html`, `styles.css`;
- `cms-config.js`, `cms-public.js`;
- папку `admin/`;
- `assets/vendor/supabase-2.112.3.js`;
- `supabase/001_cms_schema.sql` и документацию — для воспроизводимости настроек.

После commit/push дождитесь завершения GitHub Pages deployment и повторите проверки на `https://golosovsv.ru/` и `https://golosovsv.ru/admin/`.

После этого изменения дел и фотографии выполняются через Supabase и больше не требуют commit/push.
