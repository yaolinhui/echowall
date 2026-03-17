# KudosWall 🌟

[![CI](https://github.com/yaolinhui/kudoswall/actions/workflows/ci.yml/badge.svg)](https://github.com/yaolinhui/kudoswall/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://react.dev/)

> 🚀 **Lightweight Social Proof Tool** —— Auto-collect positive reviews from the web, generate embeddable testimonial walls

**English** | [简体中文](./README.md)

---

## 📖 Introduction

**KudosWall** is an open-source social proof tool designed for indie developers, creators, and small businesses. It automatically collects positive mentions from platforms like GitHub, Product Hunt, Twitter, Zhihu, and Xiaohongshu, filters them through AI sentiment analysis, and generates embeddable widgets for your website — helping you build trust and boost conversions at low cost.

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔍 **Multi-platform Fetching** | Support GitHub, Product Hunt, Twitter, Zhihu, Xiaohongshu |
| 🤖 **AI Sentiment Analysis** | Automatically identify positive mentions, filter negative/neutral |
| 🎨 **Diverse Display Modes** | Carousel, grid, list layouts with customizable themes |
| 📱 **Responsive Design** | Perfectly adapted for desktop and mobile |
| 🔧 **Open Source & Self-hosted** | Free self-deployment, full data ownership |
| ⚡ **Real-time Sync** | Redis-based async task scheduling with automatic updates |

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Backend API** | NestJS + TypeScript | v10.x |
| **Database** | PostgreSQL (prod) / SQLite (test) | - |
| **Cache/Queue** | Redis + Bull | - |
| **Frontend Admin** | React + Tailwind CSS | v18.x |
| **Embed Widget** | Vanilla JavaScript | ES6+ |
| **AI Analysis** | OpenAI API / Custom Model | - |
| **Testing** | Jest (backend) + Vitest (frontend) | - |
| **E2E Testing** | Playwright | - |

---

## 📁 Project Structure

```
KudosWall/
├── 📂 backend/              # NestJS backend service
│   ├── src/
│   │   ├── adapters/        # Platform adapters (GitHub, ProductHunt...)
│   │   ├── users/           # User module
│   │   ├── projects/        # Project module
│   │   ├── sources/         # Data source module
│   │   ├── mentions/        # Mention/testimonial module
│   │   ├── widget/          # Widget service
│   │   └── fetcher/         # Scheduled fetching service
│   └── test/                # E2E tests
├── 📂 frontend/             # React admin dashboard
│   ├── src/pages/           # Dashboard, Projects, Mentions...
│   └── src/components/      # Shared components
├── 📂 widget/               # Embeddable testimonial widget
├── 📂 e2e/                  # Playwright E2E tests
├── 📂 tests/load/           # k6 load testing scripts
└── 📂 docs/                 # Documentation
```

---

## 🚀 Quick Start

### Option 1: Docker One-Click Deploy (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/yaolinhui/kudoswall.git
cd kudoswall

# 2. Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start all services
docker-compose up -d

# 4. Access the application
# Admin Dashboard: http://localhost:3000
# Backend API: http://localhost:3001/api
```

### Option 2: Local Development

```bash
# 1. Start backend
cd backend
npm install
npm run start:dev

# 2. Start frontend (new terminal)
cd frontend
npm install
npm run dev

# 3. Access http://localhost:5173
```

---

## 🧪 Testing

The project includes a complete test suite to ensure code quality and stability:

```bash
# Backend Unit Tests (29 tests ✅)
cd backend && npm run test:unit

# Backend E2E Tests (22/24 tests ✅)
cd backend && npm run test:e2e

# Frontend Component Tests (19 tests ✅)
cd frontend && npm run test:run

# All tests
make test
```

### Test Coverage

| Module | Line Coverage | Status |
|--------|--------------|--------|
| UsersService | ~85% | ✅ |
| ProjectsService | ~80% | ✅ |
| SourcesService | ~75% | ✅ |
| GithubAdapter | ~90% | ✅ |

---

## 📚 Documentation

- [📘 Backend Development Guide](./backend/README.md)
- [📗 Frontend Development Guide](./frontend/README.md)
- [🧪 Local Testing Guide](./docs/testing/LOCAL_TESTING_GUIDE.md) ⬅️ **Getting Started**
- [📊 Test Report](./docs/testing/TEST_REPORT_FINAL.md)
- [📋 API Documentation](./docs/API.md) (WIP)
- [🏗️ Architecture Design](./docs/ARCHITECTURE.md) (WIP)

---

## 🎯 Feature Roadmap

### Implemented ✅

- [x] User registration/login/management
- [x] Project creation and management
- [x] Data source configuration (GitHub, ProductHunt)
- [x] Automatic mention fetching
- [x] AI sentiment analysis
- [x] Testimonial widget generation
- [x] Responsive admin dashboard
- [x] Docker deployment support
- [x] CI/CD automated testing

### In Progress 🚧

- [ ] More platform adapters (Twitter, Zhihu, Xiaohongshu)
- [ ] Advanced filtering and search
- [ ] Analytics dashboard
- [ ] Subscription billing system

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please ensure your code follows our coding standards and all tests pass.

---

## 📄 License

MIT License © 2026 [yaolinhui](https://github.com/yaolinhui)

See [LICENSE](./LICENSE) for full details.

---

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [React](https://react.dev/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Bull](https://github.com/OptimalBits/bull) - Redis-based queue system

---

## 🌟 Star History

If this project helps you, please give us a ⭐!

[![Star History Chart](https://api.star-history.com/svg?repos=yaolinhui/kudoswall&type=Date)](https://star-history.com/#yaolinhui/kudoswall&Date)

---

## 📮 Contact

- Issues: [GitHub Issues](https://github.com/yaolinhui/kudoswall/issues)
- Email: Please use GitHub issues for bug reports and feature requests

---

<p align="center">Made with ❤️ by <a href="https://github.com/yaolinhui">yaolinhui</a></p>
