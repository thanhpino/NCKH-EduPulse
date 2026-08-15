# 🎓 EduPulse

> **Hệ thống Giám sát & Điều tiết Tải Chủ động cho Đăng ký Học phần**

[![CI/CD](https://github.com/<username>/EduPulse/actions/workflows/ci.yml/badge.svg)](https://github.com/<username>/EduPulse/actions)

## 📋 Mô tả

EduPulse giải quyết vấn đề **quá tải hệ thống đăng ký học phần** tại các trường ĐH Việt Nam bằng cơ chế **Virtual Waiting Room** — chủ động điều tiết tải thay vì chỉ giám sát.

### Điểm khác biệt cốt lõi

| Công cụ truyền thống | EduPulse |
|---|---|
| Chỉ quan sát & báo cáo | **Can thiệp trực tiếp vào luồng traffic** |
| Cảnh báo sau khi sập | **Ngăn sập xảy ra** |
| Thủ công chia khung giờ | **Tự động điều tiết tốc độ admission** |

## 🏗️ Kiến trúc

```
                    ┌─────────────────┐
                    │   Dashboard     │
                    │  (React/HTML)   │
                    └────────┬────────┘
                             │
┌──────────┐    ┌────────────┴────────────┐    ┌──────────────┐
│  Client  │───▶│  Traffic Shaping Gateway │───▶│ Mock Backend │
│ (Browser)│    │     (Node.js + Redis)    │    │  (Express)   │
└──────────┘    └────────────┬────────────┘    └──────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────┴──────┐ ┌────┴─────┐ ┌──────┴───────┐
     │ Probe Engine  │ │ Capacity │ │    Alert     │
     │ (TimescaleDB) │ │ Advisor  │ │   Service    │
     └───────────────┘ │(Postgres)│ │ (Telegram)   │
                       └──────────┘ └──────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React / HTML+CSS+JS + Chart.js |
| Backend Services | Node.js + Express |
| Capacity Advisor | Python / Node.js |
| Databases | MongoDB, Redis, TimescaleDB, PostgreSQL |
| Infrastructure | Docker, Nginx, Terraform, AWS EC2 |
| CI/CD | GitHub Actions |
| Load Testing | k6 / JMeter |

## 🚀 Quick Start

### Yêu cầu

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js](https://nodejs.org/) >= 18
- [Git](https://git-scm.com/)

### Chạy với Docker Compose

```bash
# Clone repo
git clone https://github.com/<username>/EduPulse.git
cd EduPulse

# Copy file env mẫu
cp .env.example .env

# Khởi chạy toàn bộ services
docker compose up -d

# Xem logs
docker compose logs -f
```

### Chạy từng service (dev mode)

```bash
# Ví dụ: chạy mock-backend
cd services/mock-backend
npm install
npm run dev
```

## 📁 Cấu trúc dự án

```
EduPulse/
├── services/
│   ├── registry-service/       # Đăng ký target, cấu hình ngưỡng
│   ├── traffic-gateway/        # ★ Virtual Waiting Room + Rate Control
│   ├── probe-engine/           # Đo latency/error rate
│   ├── capacity-advisor/       # ★ Bộ não điều tiết tự động
│   ├── alert-service/          # Cảnh báo qua Telegram
│   └── mock-backend/           # Backend giả lập (fragile by design)
├── dashboard/                  # Admin panel + Public status page
├── infra/
│   ├── terraform/              # IaC cho AWS
│   └── nginx/                  # Reverse proxy config
├── .github/workflows/          # CI/CD pipelines
├── loadtest/                   # k6/JMeter scripts
├── docs/                       # Tài liệu, ERD
├── docker-compose.yml
└── .env.example
```

## 👥 Team

| Thành viên | Vai trò |
|---|---|
| A | Backend / Data |
| B | Hạ tầng / DevOps |

## 📄 License

[MIT](LICENSE)
