# CR_reg_bot

Telegram-бот и Mini App для регистрации на турнир Clash Royale.

## Что реализовано

- `/api/webhook`:
  - обрабатывает `/start`;
  - отправляет кнопку `Открыть регистрацию`;
  - если пользователь уже зарегистрирован в Blob, добавляет кнопку `Изменить регистрацию`.
- `/miniapp` (Telegram WebApp):
  - форма из полей `ФИО`, `номер группы`, `CR ID`, `CR nickname`;
  - клиентская и серверная валидации по вашим правилам.
- `/api/register`:
  - проверяет Telegram `initData` подпись;
  - проверяет пользователя в `mephi_users.xlsx` по связке `ФИО + номер группы`;
  - сохраняет регистрацию в Vercel Blob как `<tg_id>/<timestamp>.txt`;
  - при повторной регистрации без режима редактирования возвращает ошибку `needChange=true`.
  - по умолчанию записывает Blob с `access=public` (можно переопределить `BLOB_ACCESS=private`).
- `/api/set-webhook`:
  - устанавливает Telegram webhook на `/api/webhook`.

## Структура данных в Blob

`<tg_id>/<timestamp>.txt`, внутри:

- `tg id`
- `фио`
- `номер группы`
- `CR id`
- `CR nickname`
- `timestamp`

## Валидации

- ФИО:
  - только русские буквы и пробелы;
  - минимум 2 слова;
  - длина больше 5.
- Номер группы:
  - без английских букв;
  - без спецсимволов;
  - ровно одно тире;
  - длина больше 3.
- CR ID:
  - начинается с `#`;
  - без русских букв;
  - длина больше 3;
  - после `#` только латиница и цифры.
- CR nickname:
  - без русских матерных выражений (базовый фильтр по шаблонам).

## Локальный запуск

1. Установите зависимости:
   - `npm install`
2. Заполните переменные окружения:
   - `TELEGRAM_BOT_TOKEN` (или используйте локальный `bot_token.env`)
   - `BASE_URL` (например, `https://your-app.vercel.app`)
   - `BLOB_READ_WRITE_TOKEN` (из Vercel Blob)
   - `TELEGRAM_WEBHOOK_SECRET` (опционально)
   - `SET_WEBHOOK_KEY` (опционально, защита `/api/set-webhook`)
   - также поддерживаются алиасы: `TELEGRAMM_BOT_TOEN_CR_REG`, `BASE_URL_CR_REG`, `BLOB_READ_WRITE_TOKEN_CR_REG`.
3. Настройте webhook:
   - `npm run set:webhook`
   - или вызовите `GET/POST /api/set-webhook`.

## Деплой на Vercel

1. Авторизуйтесь:
   - `vercel login`
2. Привяжите проект:
   - `vercel link`
3. Создайте Blob Store в Vercel Dashboard и добавьте `BLOB_READ_WRITE_TOKEN` в Project Environment Variables.
4. Добавьте остальные env-переменные (`TELEGRAM_BOT_TOKEN`, `BASE_URL` и т.д.).
5. Деплой:
   - `vercel --prod`
6. После деплоя настройте webhook:
   - `https://<your-domain>/api/set-webhook`
   - если включили ключ: `https://<your-domain>/api/set-webhook?key=<SET_WEBHOOK_KEY>`

## GitHub

Для публикации в `CR_reg_bot`:

1. `git init`
2. `git add .`
3. `git commit -m "Initial Telegram bot + mini app registration flow"`
4. `git branch -M main`
5. `git remote add origin <URL_репозитория_CR_reg_bot>`
6. `git push -u origin main`
