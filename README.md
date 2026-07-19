# DolphinForge

**DolphinForge** — внутренний инструмент агентства для быстрого копирования
профиля DolphinAnty с сохранением привычных настроек клиента и автоматическим назначением
прокси нужного региона из общей Google-таблицы.

> Stack: **Electron + React + TypeScript** (electron-vite). Вся логика Dolphin/Google выполняется
> в main-процессе — токены не попадают в UI.

`v0.1.0-alpha.2 — DolphinForge by F4rm4ceft`

---

## Возможности

- 📋 **Список профилей** из DolphinAnty с фильтрами как в самом Dolphin (тег / статус / main website /
  пользователь), поиском и закреплением сверху.
- 🧬 **Копирование** профиля (до 8 копий за раз): клонирование (куки/вкладки) → применение
  «Базовых настроек» → назначение прокси региона. Индекс добавляется в конец имени (`имя 1`, `имя 2`…).
- 🌍 **3 региона** (624 / 726 / 859) — каждому соответствует свой лист прокси в Google-таблице.
- ⚙️ **Базовые настройки профиля** — зеркало настроек Dolphin в том же порядке, с режимами
  real/manual/auto/noise/off, версиями ОС, папкой и статусом, кнопками «сгенерировать».
- 🎲 **CSV-рандомизация** UA / MAC / Device Name (без повторов) по галочке.
- 🔌 **Пул прокси** в Google Sheets: берётся первая свободная строка, помечается `1`
  (с защитой от гонки при нескольких сотрудниках).
- 🛠 **Админ-панель «Отладка»** — живой лог всех действий + запись в файл.

---

## Настройка сервисного аккаунта Google

1. [Google Cloud Console](https://console.cloud.google.com) → создать/выбрать проект.
2. APIs & Services → Library → включить **Google Sheets API**.
3. Credentials → Create → **Service account** → создать.
4. У аккаунта: Keys → Add key → **JSON** → скачать файл.
5. Скопировать email аккаунта (`...@...iam.gserviceaccount.com`).
6. Расшарить Google-таблицу на этот email с ролью **Editor**.
7. В приложении: **Настройки** → указать путь к JSON + ID таблицы (из URL).

Структура листа региона: столбец `SOCKS5 RU` = `IP:Порт:Логин:Пароль`, соседний справа — маркер
занятости (пусто / `1`).

---

## Запуск для разработки

```bash
npm install
npm run dev
```

## Сборка установщика (Windows)

```bash
npm run dist   # → dist/DolphinForge Setup 0.1.0-alpha.2.exe
```

---

## Структура проекта

```
src/
  shared/            общие типы + дефолты (зеркало настроек Dolphin)
  main/              backend (main-процесс Electron)
    config/store.ts        конфиг (electron-store)
    dolphin/client.ts      Remote API: list/clone/update/delete/proxy + куки
    domain/profileSettings генератор payload из «Базовых настроек»
    sheets/proxyPool.ts    пул прокси в Google Sheets (claim с защитой от гонки)
    csv/csvPool.ts         пул строк CSV без повторов
    services/copyProfile.ts оркестратор «Копировать»
    logger.ts / ipc.ts / index.ts   логи, IPC, окно
  preload/index.ts   безопасный мост window.api.*
  renderer/          GUI (React + Tailwind)
```

## Настройки приложения (хранятся локально)

`%APPDATA%/DolphinForge/config.json` — токен Dolphin, service-account, ID таблицы, регионы,
базовые настройки. Логи: `%APPDATA%/DolphinForge/logs/app.log`.

---

## Известные нюансы Dolphin API

- Нативного `/clone` нет (404) → клон делается через `GET` + `POST` + перенос куки.
- При создании копии вырезаются облачные/serverside-поля исходника (`storagePath` и т.п.),
  иначе `403 E_ACCESS_DENIED_FOR_CLOUD_SYNC`.
- В `manual`-режиме Dolphin требует значения (vendor/renderer, resolution и т.д.) — иначе
  `403 WRONG_PARAMETER`; приложение подстраховывает откатом на real/auto.
- `webgpu` в запись временно не отправляется (форма записи не подтверждена).
- Перенос куки зависит от доступности эндпоинта `/cookies` на конкретном токене.

## Лицензия

[MIT](LICENSE) © 2026 F4rm4ceft
