---
title: "Добро пожаловать в Content Platform"
description: "Универсальная контентная платформа для создания современных веб-сайтов и лендингов"
status: published
publishedAt: 2025-01-01

sections:
  - type: hero
    id: hero
    title: "Content Platform"
    subtitle: "Создавайте современные лендинги за минуты"
    description: "Универсальная контентная платформа на базе Astro и Hono с библиотекой готовых секций"
    ctaText: "Начать сейчас"
    ctaHref: "#features"
    ctaSecondaryText: "Узнать больше"
    ctaSecondaryHref: "#about"
    align: center
    height: large
    overlay: true
    overlayOpacity: 0.5

  - type: features
    id: features
    title: "Почему выбирают нас"
    subtitle: "Современные технологии и лучшие практики"
    columns: 3
    items:
      - icon: "rocket"
        title: "Быстрый старт"
        description: "Готовые секции позволяют собрать лендинг за считанные минуты"
      - icon: "palette"
        title: "Гибкая дизайн-система"
        description: "Настраиваемые цвета, шрифты и отступы через единый конфиг"
      - icon: "mobile"
        title: "Адаптивность"
        description: "Все секции отлично работают на любых устройствах"
      - icon: "moon"
        title: "Тёмная тема"
        description: "Поддержка светлой и тёмной темы из коробки"
      - icon: "zap"
        title: "Производительность"
        description: "Оптимизированный код и статическая генерация"
      - icon: "shield"
        title: "Безопасность"
        description: "Встроенные меры безопасности и защита данных"

  - type: snippet
    id: about
    title: "О платформе"
    content: |
      Content Platform — это современный инструмент для создания лендингов и контентных сайтов.

      Наш подход основан на компонентной архитектуре: каждая секция — это готовый «кирпичик», который можно настроить под свои нужды.

      **Ключевые возможности:**
      - Библиотека из 20+ готовых секций
      - Настраиваемая дизайн-система
      - Админка для управления контентом
      - SSG/SSR на выбор
    image: "/images/platform-preview.jpg"
    imagePosition: right
    ctaText: "Подробнее"
    ctaHref: "/about"

  - type: stats
    id: stats
    items:
      - value: 20
        suffix: "+"
        label: "Готовых секций"
      - value: 100
        suffix: "%"
        label: "Адаптивность"
      - value: 99
        suffix: "/100"
        label: "Lighthouse Score"
      - value: 24
        suffix: "/7"
        label: "Поддержка"

  - type: testimonials
    id: testimonials
    title: "Отзывы клиентов"
    layout: grid
    items:
      - content: "Content Platform помог нам запустить лендинг для нового продукта за один день. Раньше на это уходила неделя."
        author: "Александр Иванов"
        role: "CEO, TechStartup"
        rating: 5
      - content: "Гибкая дизайн-система позволила нам полностью кастомизировать внешний вид под бренд компании."
        author: "Мария Петрова"
        role: "Marketing Director"
        rating: 5
      - content: "Отличная производительность и SEO из коробки. Наш сайт теперь в топе поисковой выдачи."
        author: "Дмитрий Сидоров"
        role: "SEO Specialist"
        rating: 5

  - type: faq
    id: faq
    title: "Частые вопросы"
    items:
      - question: "Нужны ли навыки программирования?"
        answer: "Нет, для базового использования достаточно редактировать MD файлы. Для продвинутой кастомизации понадобится знание Astro и CSS."
      - question: "Можно ли использовать свой дизайн?"
        answer: "Да, дизайн-система полностью настраиваема через theme.config.ts. Вы можете изменить цвета, шрифты, отступы и другие параметры."
      - question: "Поддерживается ли SSR?"
        answer: "Да, вы можете выбрать SSG или SSR режим для каждой страницы через настройки в frontmatter."
      - question: "Как добавить свои секции?"
        answer: "Создайте Astro компонент в папке components/sections и зарегистрируйте его в sections.ts. После этого он будет доступен в Landing Builder."

  - type: cta
    id: cta
    title: "Готовы начать?"
    description: "Создайте свой первый лендинг прямо сейчас"
    buttonText: "Начать бесплатно"
    buttonHref: "/signup"
    variant: primary
---

Дополнительный контент страницы в формате Markdown.

Этот текст будет отображаться после всех секций, если это необходимо.
