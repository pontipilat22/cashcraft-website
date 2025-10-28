# Cashcraft Website

Простой сайт для приложения Cashcraft с файлом app-ads.txt для AdMob.

## 📁 Структура:

```
cashcraft-website/
├── index.html       # Главная страница сайта
├── app-ads.txt      # Файл для верификации AdMob
└── README.md        # Этот файл
```

## 🚀 Как разместить на GitHub Pages:

### 1. Создайте репозиторий на GitHub:
1. Зайдите на https://github.com
2. Нажмите "New repository"
3. Имя: `cashcraft-website`
4. Public
5. Create repository

### 2. Загрузите файлы:

```bash
cd C:\project\cashcraft-website
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ваш-username/cashcraft-website.git
git push -u origin main
```

### 3. Включите GitHub Pages:
1. Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: "main" → "/ (root)"
4. Save

### 4. Ваш сайт будет доступен:
```
https://ваш-username.github.io/cashcraft-website/
```

### 5. Проверьте app-ads.txt:
```
https://ваш-username.github.io/cashcraft-website/app-ads.txt
```

### 6. Укажите в AdMob Console:
- Developer website: `https://ваш-username.github.io/cashcraft-website`

---

## 🌐 Альтернатива - Netlify (еще проще):

### Через веб-интерфейс:
1. Зайдите на https://app.netlify.com/
2. Drag & Drop папку `cashcraft-website`
3. Получите URL: `https://your-app.netlify.app`

### Или через Netlify CLI:
```bash
npm install -g netlify-cli
cd C:\project\cashcraft-website
netlify deploy --prod
```

---

## ✅ Готово!

Теперь у вас есть:
- ✅ Красивый сайт для приложения
- ✅ Файл app-ads.txt для AdMob
- ✅ Готовность к размещению в интернете
