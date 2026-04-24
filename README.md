# SIRT Smart Library

Full-stack Smart Library Management System with RFID integration, real-time updates via Socket.IO, and AI-powered book recommendations using Google Gemini.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Real-time:** Socket.IO
- **AI:** Google Generative AI (Gemini)

## Environment Variables

Create a `.env` file in the root with:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=LibraryDB
GEMINI_API_KEY=your_gemini_api_key
```

## Local Development

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## Deployment

### Frontend (Netlify)

The `public/` folder is configured for static deployment on Netlify via `netlify.toml`.

### Backend (Render/Railway)

The Express server requires a platform that supports Node.js runtime and MySQL connectivity.

## Important Notes

- Netlify can only host the **static frontend**. The backend APIs require a Node.js server.
- For full functionality, deploy backend separately to Render, Railway, or similar.
- Update frontend API base URLs to point to your live backend.
