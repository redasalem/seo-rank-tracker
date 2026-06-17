# 🚀 SEO Rank Tracer - Backend API

A robust backend service for tracking SEO keyword rankings and performing deep SEO page analysis. Built with Node.js, Express, and MongoDB, utilizing headless browsers (`Playwright` & `BrowserbaseHQ`) for highly accurate search engine scraping.

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Playwright-45ba4b?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
</div>

## 🛠 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose)
- **Authentication:** JWT (JSON Web Tokens) & bcrypt
- **Scraping Engine:** Playwright Core & BrowserbaseHQ SDK
- **Task Scheduling:** node-cron (for automated tracking)
- **Deployment ready:** Vercel (Serverless Functions)

## 📁 Directory Structure

```text
server/
├── config/         # Database configuration
├── controllers/    # Route logic and handlers
├── jobs/           # Scheduled cron jobs for rank tracking
├── middleware/     # Custom middlewares (e.g., Auth verification)
├── models/         # Mongoose database schemas
├── routes/         # Express API route definitions
├── services/       # Core business logic (Scraping, Analysis)
└── server.js       # Application entry point
```

## ⚙️ Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
BROWSERBASE_API_KEY=your_browserbase_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
```

## 📚 API Documentation

All endpoints are prefixed with `/api`. Most endpoints require a Bearer JWT token in the `Authorization` header.

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/register` | Register a new user | ❌ |
| `POST` | `/login` | Authenticate user & get token | ❌ |
| `POST` | `/logout` | Logout user (invalidate token) | ❌ |
| `GET`  | `/getCurrentUser` | Get logged-in user details | ✅ |

### 📈 Rank Tracking (`/api/rank`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET`  | `/` | Get all tracked keywords for user | ✅ |
| `GET`  | `/:id` | Get details/history of a specific keyword | ✅ |
| `POST` | `/add` | Add a new keyword to track | ✅ |
| `DELETE`| `/:id` | Delete a tracked keyword | ✅ |
| `POST` | `/:id/refresh` | Force manual refresh of keyword ranking | ✅ |
| `PUT`  | `/:id/toggle` | Pause/Resume automated tracking for keyword | ✅ |

### 🔍 SEO Analysis (`/api/analysis`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/start` | Start a new deep SEO analysis for a URL | ✅ |
| `GET`  | `/:id` | Get the results of a specific analysis | ✅ |

## ⏱️ Background Jobs
The backend utilizes `node-cron` to automatically check keyword rankings periodically. 
*Note: When deployed to Vercel (`VERCEL=1`), the internal node-cron is disabled in favor of Vercel's native Cron Jobs configured in `vercel.json`.*

## 🚀 Running Locally

1. Install dependencies: `npm install`
2. Start the development server: `npm run server` (uses nodemon)
3. The server will start on `http://localhost:5000`
