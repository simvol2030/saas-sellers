# CLAUDE.local.md - Workflow v4.2 (Single Branch)

> **Пути проекта:** см. `CLAUDE.md`

---

## Роли

| Роль | Агент | Ответственность |
|------|-------|-----------------|
| **Moderator** | Пользователь | Задачи, решения, координация |
| **Developer** | Claude Code Web | Код, фичи, баги (score 6+) |
| **Integrator** | Claude Code CLI | Deploy, QA, hot-fix, merge в main (score 0-5) |

---

## Главное правило v4.2

> **Работаем только с веткой `main`**. Ветки `dev` нет!

```
GitHub:
├── main              ← единственная постоянная ветка
└── claude/*          ← временные ветки
```

### Когда удалять временные ветки claude/*

| Удалять | НЕ удалять |
|---------|------------|
| Блок задач завершён и протестирован | Ещё есть связанные баги |
| Все фиксы смержены в main | Ждём feedback от QA |
| QA подтвердил работоспособность | Задача в процессе доработки |

**Правило:** Удаляем ветку когда весь блок задач (фича + все связанные фиксы) завершён и работает на production.

---

## Цикл разработки

```
1. Moderator    → Ставит задачу Developer'у
2. Developer    → Код в ветке claude/*, commit, push
3. Moderator    → Копирует ответ Developer'а → отправляет Integrator'у
4. Integrator   → АВТОМАТИЧЕСКИ выполняет: merge → deploy → build → QA
5. Integrator   → Открывает браузер, проверяет результат
6. Integrator   → Классифицирует баги и предлагает план:
                  - Score 0-5: "Исправлю сам" → hot-fix → push main
                  - Score 6+: "Нужен Developer" → готовит feedback
7. Moderator    → Подтверждает план / корректирует
8. [Повтор пока не OK]
```

### Автоматизация для Integrator

**Когда Moderator присылает ответ от Claude Web:**
1. Сразу выполнять workflow (merge → deploy → build)
2. Открыть браузер (playwright) для проверки
3. Дать отчёт: что работает, что нет
4. Предложить классификацию: что фиксить самому, что отдать Developer'у
5. Ждать подтверждения Moderator'а

---

## Скоринг задач

**Формула:**
```
Score = (Сложность × 3) + (Файлы × 2) + (Риск × 2) + (Время × 1)
```

| Критерий | 0 | 1 | 2 | 3 |
|----------|---|---|---|---|
| Сложность (×3) | Текст/опечатки | Конфиги | CSS/простая логика | Бизнес-логика |
| Файлы (×2) | 1 файл | 2-3 | 4-6 | 7+ |
| Риск (×2) | Контент/стили | Компоненты | БД/API/auth | - |
| Время (×1) | <2 мин | 2-10 мин | >10 мин | - |

**Классификация:**
- **0-5** → CLI делает сам
- **6-10** → Обсуждаем
- **11+** → Claude Web делает

---

## Защита GitHub репозитория (КРИТИЧНО)

> **Медиа-файлы в git = блокировка workflow!**
> Раздутый репозиторий замедляет clone/pull/deploy и может полностью заблокировать работу.

### Что НЕ должно попадать в git

| Тип | Расширения | Почему критично |
|-----|------------|-----------------|
| Изображения | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg` | Быстро раздувают репо |
| Видео | `.mp4`, `.webm`, `.mov`, `.avi` | Очень большие файлы |
| Аудио | `.mp3`, `.wav`, `.ogg` | Большие файлы |
| Архивы | `.zip`, `.tar.gz`, `.rar` | Бэкапы не в git |
| Build | `node_modules/`, `dist/`, `build/`, `.svelte-kit/` | Генерируются автоматически |

### Стандартные исключения .gitignore

```gitignore
# Uploads (user-generated content)
backend-expressjs/uploads/
!backend-expressjs/uploads/.gitkeep
!backend-expressjs/uploads/*/.gitkeep

# Dynamic assets
frontend-sveltekit/static/logo.png
frontend-sveltekit/static/logo.webp

# Media files (safety net)
*.jpg
*.jpeg
*.png
*.webp
*.gif
*.mp4
*.webm

# Build artifacts
node_modules/
dist/
build/
.svelte-kit/

# Backups
*.tar.gz
uploads-backup-*.tar.gz
```

### Постоянный мониторинг

**При каждом коммите проверять:**
```bash
git status | grep -E "\.(jpg|jpeg|png|webp|gif|mp4|webm)$"
# Должно быть пусто!
```

**При добавлении новой upload-директории:**
1. Создать на сервере
2. Добавить в .gitignore
3. Создать .gitkeep
4. Commit .gitignore

---

## Бэкап uploads на сервере

### Создание бэкапа
```bash
cd $SERVER_PATH/backend-expressjs
tar -czvf ../uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

### Восстановление
```bash
cd $SERVER_PATH/backend-expressjs
tar -xzvf ../uploads-backup-YYYYMMDD.tar.gz
```

---

## Команды (универсальные)

> Конкретные пути см. в `CLAUDE.md`

### Deploy на production
```bash
# Через SSH MCP
cd $SERVER_PATH && git pull origin main
cd backend-expressjs && npm install && npm run build
cd ../frontend-sveltekit && npm install && npm run build
source ~/.nvm/nvm.sh && pm2 restart $PM2_FRONTEND $PM2_BACKEND
```

### Merge ветки Claude Web
```bash
cd $SERVER_PATH
git fetch origin
git merge origin/claude/branch-name --no-ff -m "feat: description"
# Затем build + restart
```

### Hot-fix на сервере
```bash
cd $SERVER_PATH
# Внести правки...
git add . && git commit -m "fix: description"
git push origin main
```

### Локальная синхронизация
```bash
cd $LOCAL_PATH
git pull origin main
```

### Rollback
```bash
git revert HEAD
npm run build && pm2 restart $PM2_FRONTEND
```

---

## Feedbacks

**Директория:** `./feedbacks/`
**Формат:** `feedback-v1.md`, `feedback-v2.md`, ...

```markdown
# Feedback vX - [Краткое описание]

**Дата:** YYYY-MM-DD
**Branch to create:** claude/task-name-vX

## Что работает
- ...

## Баги (score 6+)
### Bug 1: [Название]
- **Score:** X
- **Steps:** ...
- **Expected/Actual:** ...
- **Files:** ...

## Мелкие правки (score 0-5) - уже сделано CLI
- ...
```

---

## CLI Integrator - справка

**При получении ответа от Claude Web — автоматически:**
1. Merge ветки claude/* в main
2. Deploy на сервер (pull → build → restart)
3. Открыть браузер и проверить результат
4. Дать отчёт + классификацию багов
5. После подтверждения — фиксить (0-5) или готовить feedback (6+)

**Делаю сам (score 0-5):**
- Опечатки, CSS-правки
- Мелкие баги в 1-3 файлах
- Hot-fix → push main

**Передаю Developer (score 6+):**
- Бизнес-логика
- Новые фичи
- Рефакторинг
- Баги в 4+ файлах

**Всегда слежу:**
- .gitignore актуален (нет медиа в git)
- Бэкапы uploads существуют

---

## Настройка нового проекта

### 1. Git на сервере
```bash
cd $SERVER_PATH
git init  # или git clone
git remote add origin $GITHUB_REPO
git checkout main
```

### 2. .gitignore
- Добавить все uploads директории
- Добавить динамические ассеты (logo и т.д.)
- Проверить: `git status` не должен показывать медиа-файлы

### 3. PM2
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 4. Бэкап uploads
```bash
tar -czvf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

### 5. CLAUDE.md
Заполнить все пути и доступы в главном файле проекта.

---

## Переменные (из CLAUDE.md)

| Переменная | Описание |
|------------|----------|
| `$SERVER_PATH` | Путь к проекту на сервере |
| `$LOCAL_PATH` | Путь к проекту локально (WSL) |
| `$GITHUB_REPO` | URL репозитория GitHub |
| `$PM2_FRONTEND` | Имя PM2 процесса frontend |
| `$PM2_BACKEND` | Имя PM2 процесса backend |

---

*Версия: 4.2 | Single Branch (main only)*
*Пути проекта: см. CLAUDE.md*
