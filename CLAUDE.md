# SaaS Sellers - Landing Builder

**URL:** https://saas.mix-id.ru
**Тип:** Landing Page Builder + CMS с админ-панелью
**Workflow:** см. `CLAUDE.local.md`

---

## Пути проекта

| Среда | Путь |
|-------|------|
| **WSL** | `/home/solo18/devapps/saas-sellers/project/project-box-combo-2` |
| **Windows** | `\\wsl$\Ubuntu\home\solo18\devapps\saas-sellers\project\project-box-combo-2` |
| **GitHub** | https://github.com/simvol2030/saas-sellers |
| **GitHub ветка** | `main` (единственная рабочая) |
| **Сервер** | `/opt/websites/saas.mix-id.ru` |

---

## PM2 (Production)

| Процесс | Порт |
|---------|------|
| `saas-sellers-backend` | 3008 |
| `saas-sellers-frontend` | 3017 |

```bash
source ~/.nvm/nvm.sh && pm2 restart saas-sellers-backend saas-sellers-frontend
```

---

## Доступы

**Admin Panel:** https://saas.mix-id.ru/admin/login
- Credentials: создать через Prisma Studio или seed

**Database:** SQLite (WAL) → `/opt/websites/saas.mix-id.ru/backend-hono/data/db/prod.db`

---

## Структура

```
saas-sellers/
├── frontend-astro/      # Astro 5.x + Svelte 5 (SSR)
├── backend-hono/        # Hono 4.x REST API
├── data/                # БД, медиа, логи
│   ├── db/
│   ├── media/
│   └── logs/
├── docs/                # Документация
└── prisma/              # Схема БД
```

---

## Tech Stack

- **Frontend:** Astro 5.x, Svelte 5, TypeScript
- **Backend:** Hono 4.x, Prisma 6.x, SQLite/PostgreSQL
- **Auth:** JWT (jose), bcrypt
- **DevOps:** PM2, Nginx, SSH-MCP, GitHub MCP

---

## Deploy

```bash
# На сервере (через SSH MCP)
cd /opt/websites/saas.mix-id.ru && git pull origin main
cd backend-hono && npm install && npm run build
cd ../frontend-astro && npm install && npm run build
source ~/.nvm/nvm.sh && pm2 restart saas-sellers-backend saas-sellers-frontend
```

---

## Uploads (в .gitignore)

Путь: `/opt/websites/saas.mix-id.ru/data/media/`
Бэкап: `data-media-backup-20251224.tar.gz`

Директории: images, videos, documents

---

## Ветки GitHub

| Ветка | Назначение |
|-------|------------|
| `main` | Рабочая ветка (единственная) |
| `claude/*` | Временные ветки от Claude Web (НЕ удалять если не смержены) |
| `backup-dev-before-sync` | Архивная (уникальные коммиты) |

---

*Версия: 1.0 | Создано: 2025-12-24*
*Используется с: CLAUDE.local.md (Workflow v4.2)*
