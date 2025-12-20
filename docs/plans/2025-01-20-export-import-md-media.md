# План реализации: Export/Import с MD + Media для Obsidian Workflow

**Дата:** 2025-01-20
**Статус:** РЕАЛИЗОВАНО (db34253)
**Приоритет:** Средний

---

## 1. Текущее состояние

### Backend (`backend-hono/src/routes/export-import.ts`)
- ✅ MD экспорт с gray-matter frontmatter
- ✅ Одиночный экспорт: `GET /pages/:id/export`
- ✅ Одиночный импорт: `POST /pages/import`
- ✅ Batch импорт: `POST /pages/import/batch`
- ✅ ZIP экспорт всех: `GET /pages/export-all`
- ⚠️ Иерархия: только 1 уровень вложенности (parent/child)
- ❌ Медиа-файлы не включаются в ZIP

### Frontend (`PagesList.svelte`)
- ✅ Кнопка экспорта страницы (💾) - строка 540-545
- ✅ Кнопка "Экспорт всех" (📤) - строка 410-412
- ✅ Импорт модал с выбором файлов

### Frontend (`PageEditor.svelte`)
- ❌ Нет кнопки экспорта текущей страницы

---

## 2. Требования пользователя

1. **Формат:** Frontmatter YAML + MD content → ✅ УЖЕ ГОТОВО
2. **Иерархия:** Папки (page/, page/subpage/, page/subpage/child/)
3. **Кнопки:** И в списке, и в редакторе → список готов, редактор нужен
4. **JSON:** Сохранить оба формата → ✅ УЖЕ РАБОТАЕТ
5. **Медиа в ZIP:** Для Obsidian workflow → НУЖНО ДОБАВИТЬ

---

## 3. Этапы реализации

### Этап 1: Кнопка экспорта в PageEditor (30 мин)

**Файл:** `frontend-astro/src/components/admin/PageEditor.svelte`

**Изменения:**
- Добавить функцию `exportCurrentPage()`
- Добавить кнопку "📥 Экспорт MD" в header-actions (рядом с "Сохранить")

**Код:**
```svelte
async function exportCurrentPage() {
  if (!pageId) return;

  const token = localStorage.getItem('accessToken');
  const siteId = localStorage.getItem('currentSiteId');

  const headers: HeadersInit = { Authorization: `Bearer ${token}` };
  if (siteId) headers['X-Site-ID'] = siteId;

  const response = await fetch(`/api/admin/pages/${pageId}/export`, { headers });

  if (!response.ok) {
    error = 'Ошибка экспорта';
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${page.slug}.md`;
  a.click();
  URL.revokeObjectURL(url);

  success = 'Страница экспортирована';
}
```

---

### Этап 2: Медиа-файлы в ZIP экспорт (1 час)

**Файл:** `backend-hono/src/routes/export-import.ts`

**Изменения в `GET /pages/export-all`:**

1. **Извлечь медиа-URLs из sections:**
   - Парсить `sections` JSON
   - Искать поля: `image`, `images[]`, `src`, `backgroundImage`, `avatar`, `logos[]`

2. **Структура ZIP:**
   ```
   pages-export.zip
   ├── pages/
   │   ├── home.md
   │   ├── about/
   │   │   ├── about.md
   │   │   └── team/
   │   │       └── team.md
   ├── media/
   │   ├── hero-bg.jpg
   │   ├── team-photo.png
   │   └── ...
   └── manifest.json
   ```

3. **manifest.json:**
   ```json
   {
     "exportedAt": "2025-01-20T12:00:00Z",
     "pagesCount": 15,
     "mediaCount": 8,
     "siteSlug": "default"
   }
   ```

**Код модификации:**
```typescript
// Collect all media URLs from sections
function extractMediaUrls(sections: any[]): string[] {
  const urls: string[] = [];
  const mediaFields = ['image', 'src', 'backgroundImage', 'avatar', 'ogImage'];
  const mediaArrayFields = ['images', 'logos', 'items'];

  function traverse(obj: any) {
    if (!obj || typeof obj !== 'object') return;

    for (const key of Object.keys(obj)) {
      if (mediaFields.includes(key) && typeof obj[key] === 'string' && obj[key].startsWith('/')) {
        urls.push(obj[key]);
      }
      if (mediaArrayFields.includes(key) && Array.isArray(obj[key])) {
        for (const item of obj[key]) {
          if (typeof item === 'string' && item.startsWith('/')) {
            urls.push(item);
          } else if (typeof item === 'object') {
            traverse(item);
          }
        }
      }
      if (typeof obj[key] === 'object') {
        traverse(obj[key]);
      }
    }
  }

  for (const section of sections) {
    traverse(section);
  }

  return [...new Set(urls)]; // unique
}
```

---

### Этап 3: Глубокая иерархия в ZIP (30 мин)

**Изменения в `GET /pages/export-all`:**

Текущий код:
```typescript
let filePath = `${page.slug}.md`;
if (page.parent) {
  filePath = `${page.parent.slug}/${page.slug}.md`;
}
```

Новый код с 3 уровнями:
```typescript
// Build full path based on hierarchy
async function buildPagePath(page: Page): Promise<string> {
  const parts = [page.slug];
  let current = page;

  while (current.parentId) {
    const parent = await prisma.page.findUnique({
      where: { id: current.parentId },
      select: { slug: true, parentId: true },
    });
    if (!parent) break;
    parts.unshift(parent.slug);
    current = parent as any;
  }

  return `pages/${parts.join('/')}/${parts[parts.length - 1]}.md`;
}
```

---

## 4. Результаты аудита (ДОБАВЛЕНО)

### Система медиа-файлов

**Расположение файлов:**
```
MEDIA_DIR = process.env.MEDIA_DIR || '../data/media'
Структура: /data/media/site-{siteId}/{images|videos|documents}/{filename}
```

**URL паттерн в секциях:**
```
/api/media/site-1/images/hero-bg-1734567890-abc123.jpg
```

**Важные находки:**
1. URL содержит `site-{siteId}` → нужно извлечь siteId и тип (images/videos/documents)
2. Файлы имеют уникальные имена с timestamp+uuid → дубликатов не будет
3. Максимальный размер файла: 50MB

### Алгоритм извлечения медиа

```typescript
// Паттерн для поиска локальных медиа URL
const LOCAL_MEDIA_REGEX = /\/api\/media\/site-(\d+)\/(images|videos|documents)\/([^"'\s]+)/g;

function extractMediaPaths(sections: any[]): string[] {
  const paths: string[] = [];
  const jsonStr = JSON.stringify(sections);
  let match;

  while ((match = LOCAL_MEDIA_REGEX.exec(jsonStr)) !== null) {
    const [fullUrl, siteId, type, filename] = match;
    paths.push(`site-${siteId}/${type}/${filename}`);
  }

  return [...new Set(paths)];
}
```

---

## 5. Риски и edge cases

| Риск | Вероятность | Решение |
|------|-------------|---------|
| Большие медиа-файлы (>10MB) | Средняя | Лимит на размер ZIP (100MB total), предупреждение |
| Медиа на внешних URL (https://) | Высокая | Пропускать, не включать в ZIP |
| Битые ссылки на медиа | Средняя | existsSync проверка, логировать, продолжать |
| Кодировка кириллицы в именах | Низкая | Имена уже транслитерированы (generateFilename) |
| Дубликаты медиа-файлов | Низкая | Set для уникальности, имена уникальны |
| Файл не найден на диске | Средняя | Проверка existsSync, skip с логом |

---

## 6. Файлы для изменения

| Файл | Действие | Объем |
|------|----------|-------|
| `PageEditor.svelte` | Добавить кнопку экспорта | +30 строк |
| `export-import.ts` | Медиа в ZIP + иерархия | +80 строк |
| Итого | | ~110 строк |

---

## 7. Порядок реализации

1. **PageEditor.svelte** - кнопка экспорта (простое, можно протестировать сразу)
2. **export-import.ts** - глубокая иерархия (рефакторинг buildPagePath)
3. **export-import.ts** - медиа в ZIP (extractMediaUrls + добавление в архив)
4. **Тестирование** - экспорт сайта с медиа, импорт в Obsidian

---

## 8. Решение о реализации

**Готово к реализации:** ДА

**Комментарий:**
Все изменения минимальны и обратно совместимы. Существующий функционал не затрагивается. Медиа добавляются опционально (только локальные файлы с /uploads/).

---

## 9. Следующие шаги

1. ✅ Создан план
2. ✅ Аудит плана (добавлен раздел 4 с результатами)
3. ✅ Согласовано с пользователем
4. ✅ Реализация этапов 1-3
5. ✅ Тестирование и коммит (db34253)
