# Инструкция по настройке и деплою

## Шаг 1: Получить Google Client ID

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите **Google+ API**
4. Перейдите в **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Выберите тип приложения: **Web application**
6. Добавьте **Authorized JavaScript origins**:
   - `http://localhost:3000` (для разработки)
   - `https://your-railway-app.up.railway.app` (для продакшена)
7. Скопируйте **Client ID**

## Шаг 2: Настроить MongoDB

Вариант 1: MongoDB Atlas (рекомендуется)
1. Создайте аккаунт на [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Создайте бесплатный кластер
3. Создайте пользователя базы данных
4. Получите connection string (формат: `mongodb+srv://username:password@cluster.mongodb.net/dbname`)

Вариант 2: Railway MongoDB
1. В Railway добавьте MongoDB плагин к вашему проекту
2. Railway автоматически создаст переменную `MONGODB_URL`

## Шаг 3: Настроить переменные окружения на Railway

В настройках вашего Railway проекта добавьте:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/aiphoto
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
PORT=3000
```

## Шаг 4: Обновить index.html

Замените `YOUR_GOOGLE_CLIENT_ID` в `index.html` на ваш реальный Google Client ID:

```html
<div id="g_id_onload"
     data-client_id="ВАШ_НАСТОЯЩИЙ_CLIENT_ID"
     data-callback="handleGoogleSignIn">
</div>
```

## Шаг 5: Обновить app.js

Замените `http://localhost:3000/api` на URL вашего Railway сервера:

```javascript
const API_URL = 'https://your-railway-app.up.railway.app/api';
```

## Шаг 6: Деплой на Railway

### Вариант 1: Через GitHub
1. Создайте репозиторий на GitHub
2. Загрузите папку `server` в репозиторий
3. В Railway: **New Project** → **Deploy from GitHub**
4. Выберите ваш репозиторий
5. Railway автоматически определит Node.js и задеплоит

### Вариант 2: Через Railway CLI
```bash
cd server
npm install -g @railway/cli
railway login
railway init
railway up
```

## Шаг 7: Тестирование

1. Откройте ваш сайт
2. Нажмите на кнопку Google Sign-In
3. Авторизуйтесь через Google
4. Проверьте, что вы вошли в систему
5. Сгенерируйте тестовое изображение
6. Проверьте, что оно сохранилось в галерее

## Структура проекта

```
cashcraft-website/
├── server/                    # Backend (деплоится на Railway)
│   ├── models/
│   │   ├── User.js
│   │   ├── Generation.js
│   │   └── Model.js
│   ├── index.js
│   ├── package.json
│   └── .env.example
├── assets/                    # Фотографии
├── index.html                 # Frontend
├── app.js
└── styles.css
```

## Полезные команды

### Локальная разработка backend:
```bash
cd server
npm install
# Создайте .env файл с вашими переменными
npm run dev
```

### Проверка логов на Railway:
```bash
railway logs
```

## Troubleshooting

**Проблема**: Google Sign-In не работает
- Проверьте, что Client ID правильный
- Проверьте, что домен добавлен в Authorized JavaScript origins

**Проблема**: Ошибка подключения к MongoDB
- Проверьте connection string
- Проверьте, что IP адрес разрешен в MongoDB Atlas (0.0.0.0/0 для всех)

**Проблема**: CORS ошибки
- Убедитесь, что backend использует `cors()` middleware
- Проверьте, что API_URL в app.js правильный
