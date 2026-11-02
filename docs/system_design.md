# EduPulse — Tài Liệu Thiết Kế Hệ Thống (System Design Document)

> **Tên đề tài NCKH:** Nền tảng điều tiết lưu lượng và bảo vệ hệ thống đăng ký tín chỉ tự trị dựa trên kiểm soát đón nhận thích ứng (EduPulse)  
> **Nhóm tác giả:**  
> - **Trương Minh Thành** — Trưởng nhóm, Thiết kế kiến trúc hệ thống & DevOps (System Architect & DevOps Lead)  
> - **Lâm Tấn Đạt** — Kỹ sư Backend & Công cụ phân tích dữ liệu (Backend & Data Engine Lead)  
> - **Lâm Vĩ Hoằng** — Kỹ sư Giao diện & Tích hợp trải nghiệm người dùng (Frontend & Integration Lead)  
> **Phiên bản tài liệu:** 1.0 (Phase 1 Final)  
> **Ngày cập nhật:** Tháng 11/2026

---

## 📑 MỤC LỤC
1. [Giới thiệu & Bối cảnh đề tài](#1-giới-thiệu--bối-cảnh-đề-tài)
2. [Triết lý thiết kế cốt lõi (Core Design Principles)](#2-triết-lý-thiết-kế-cốt-lõi-core-design-principles)
3. [Kiến trúc phân tầng Microservices (C4 Container View)](#3-kiến-trúc-phân-tầng-microservices-c4-container-view)
4. [Chi tiết các phân hệ chức năng (Component Specifications)](#4-chi-tiết-các-phân-hệ-chức-năng-component-specifications)
5. [Chiến lược lưu trữ đa mô hình (Polyglot Persistence)](#5-chiến-lược-lưu-trữ-đa-mô-hình-polyglot-persistence)
6. [Giải thuật điều khiển tự trị hai tầng (Dual-Layer Control Algorithm)](#6-giải-thuật-điều-khiển-tự-trị-hai-tầng-dual-layer-control-algorithm)
7. [Bảo mật & Cơ chế chống gian lận (Security & Anti-Cheating)](#7-bảo-mật--cơ-chế-chống-gian-lận-security--anti-cheating)
8. [Khả năng chịu lỗi & Suy thoái mềm (Fault-Tolerance & Graceful Degradation)](#8-khả-năng-chịu-lỗi--suy-thoái-mềm-fault-tolerance--graceful-degradation)

---

## 1. Giới thiệu & Bối cảnh đề tài

### 1.1 Vấn đề thực tiễn (Problem Statement)
Hằng kỳ, các trường đại học tại Việt Nam đều đối mặt với hiện tượng "nghẽn mạng giờ vàng" khi mở cổng đăng ký tín chỉ. Hàng chục ngàn sinh viên đồng thời truy cập, gửi hàng loạt request ghi nhận môn học trong vòng vài phút. Hậu quả:
- Máy chủ ứng dụng cạn kiệt tài nguyên (CPU, RAM, Connection Pool của Database).
- Thời gian phản hồi tăng vọt từ $50\text{ ms}$ lên $> 10\text{ giây}$, dẫn đến lỗi Gateway Timeout (`504`) và Bad Gateway (`502`).
- Sinh viên hoang mang, liên tục nhấn F5 (Refresh), tạo nên hiệu ứng bão tuyết lưu lượng (Retry Storm / Cascading Failure) khiến máy chủ sập hoàn toàn.

### 1.2 Thiếu sót của các giải pháp hiện nay
- **Giải pháp nâng cấp phần cứng (Vertical/Horizontal Scaling):** Tốn kém ngân sách lớn, trong khi nhu cầu tải đột biến chỉ xuất hiện 2–3 ngày mỗi học kỳ. Hơn nữa, nghẽn thường nằm ở Database Lock tranh chấp môn học, nâng CPU web server không giải quyết được gốc rễ.
- **Giải pháp Cloudflare Waiting Room / AWS Queue:** Chi phí dịch vụ doanh nghiệp đắt đỏ (hàng ngàn USD/tháng), thiếu tính thấu hiểu trạng thái nội tại của ứng dụng giáo dục (Application-agnostic), chỉ đếm lượng IP mà không phản hồi theo độ trễ DB thực tế.
- **Giải pháp sửa lại toàn bộ mã nguồn trường:** Rủi ro rất cao, các hệ thống đào tạo thường dùng công nghệ cũ, khó tái cấu trúc, nhà trường ngần ngại thay đổi vì sợ gián đoạn vận hành.

### 1.3 Mục tiêu EduPulse
Xây dựng một giải pháp **Sidecar Proxy thông minh** đứng chắn trước hệ thống trường học, cho phép nhà trường áp dụng ngay lập tức mà **không cần chỉnh sửa mã nguồn backend hiện hữu**, với cơ chế xếp hàng ảo thích ứng và tự động điều tiết tốc độ tháo van (Dynamic Admission Control) bảo vệ hệ thống luôn duy trì ở trạng thái hiệu năng cao nhất.

---

## 2. Triết lý thiết kế cốt lõi (Core Design Principles)

1. **Zero-Code Intrusion (Không can thiệp mã nguồn backend):**
   - Nhà trường chỉ cần đổi bản ghi DNS (Domain Name) hoặc cấu hình Reverse Proxy để trỏ lưu lượng qua EduPulse Gateway. Backend hiện tại được giữ nguyên vẹn.
2. **Closed-Loop Feedback Control (Vòng lặp phản hồi khép kín):**
   - Hệ thống không điều tiết dựa trên phỏng đoán cố định, mà liên tục đo lường độ trễ thực tế qua `probe-engine` và đưa ra quyết định dựa trên thuật toán gradient qua `capacity-advisor`.
3. **Decoupled Asynchronous Waiting Room (Phòng chờ ảo tách biệt):**
   - Hàng đợi được lưu giữ trên RAM Redis tốc độ cao (hàng chục ngàn thao tác/giây), cách ly hoàn toàn áp lực tải của sinh viên khỏi Database chính của nhà trường.
4. **Fairness & Determinism (Công bằng & Minh bạch):**
   - Áp dụng cấu trúc hàng đợi vào trước ra trước (FIFO) thông qua Redis Sorted Set với điểm số (score) là mili-giây gia nhập, đảm bảo không có hiện tượng chen ngang.

---

## 3. Kiến trúc phân tầng Microservices (C4 Container View)

```
                       [ Sinh Viên ]           [ Kỹ sư DevOps ]
                             │                         │
                             ▼                         ▼
                  ┌───────────────────────────────────────────────┐
                  │          Nginx Reverse Proxy (:80)            │
                  └──────┬────────────────────────────────┬───────┘
                         │                                │
                         ▼                                ▼
            ┌───────────────────────────┐   ┌───────────────────────────┐
            │  Traffic Gateway (:3002)   │   │   Dashboard UI (:3000)    │
            │  (Virtual Waiting Room)   │   │      (React + Vite)       │
            └────────────┬──────────────┘   └─────────────┬─────────────┘
                         │                                │
        ┌────────────────┼────────────────────────────────┘
        │                │
        ▼                ▼
  ┌───────────┐    ┌────────────────────────────────────────────────────────┐
  │   Redis   │    │                ĐỘNG CƠ ĐIỀU TIẾT TỰ TRỊ                │
  │  (:6379)  │    │                                                        │
  │           │    │  ┌─────────────────┐        ┌───────────────────────┐  │
  │ Hàng đợi  │◄───┼──│Capacity Advisor │◄───────│     Probe Engine      │  │
  │ Vé & Token│    │  │     (:3004)     │        │        (:3003)        │  │
  └───────────┘    │  └────────┬────────┘        └───────────┬───────────┘  │
                   │           │                             │              │
                   │           ▼                             ▼              │
                   │  ┌─────────────────┐        ┌───────────────────────┐  │
                   │  │  Alert Service  │        │      TimescaleDB      │  │
                   │  │     (:3005)     │        │        (:5432)        │  │
                   │  └────────┬────────┘        │ Chuỗi thời gian đo trễ│  │
                   │           │                 └───────────────────────┘  │
                   └───────────┼────────────────────────────────────────────┘
                               │
                               ▼
                   ┌───────────────────────┐
                   │  Telegram Bot Webhook │
                   └───────────────────────┘
                               │
                               ▼ (Forward khi được cấp Token)
             ┌────────────────────────────────────┐
             │       HỆ THỐNG ĐÀO TẠO ĐÍCH        │
             │   Mock Backend / Registry Service  │
             │       (Cổng 3010 / 3001)           │
             └────────────────────────────────────┘
```

---

## 4. Chi tiết các phân hệ chức năng (Component Specifications)

### 4.1 Traffic Gateway (`services/traffic-gateway` — Port 3002)
- **Công nghệ:** Node.js, Express, ioredis.
- **Nhiệm vụ:**
  - Đóng vai trò Reverse Proxy chặn cửa.
  - Quản lý hàng đợi bằng Redis Sorted Set (`queue:courseId`).
  - Kiểm tra điều kiện Admission: cấp vé `ticketId`, cho phép polling kiểm tra thứ tự, và chuyển đổi thành `passToken` (TTL 60s) khi vị trí đạt `#0`.
  - Thực thi bảo vệ: chặn mọi request đăng ký không có `passToken` hợp lệ.
  - Lắng nghe cấu hình tốc độ xả vé (`admissionRate`) từ Capacity Advisor qua endpoint nội bộ.

### 4.2 Probe Engine (`services/probe-engine` — Port 3003)
- **Công nghệ:** Node.js, TimescaleDB client.
- **Nhiệm vụ:**
  - Bắn request thăm dò nhân tạo (Synthetic Probing) định kỳ mỗi 1 giây vào backend đích.
  - Đo lường Response Time ($t_{response}$ tính bằng ms) và HTTP Status.
  - Ghi nhận dữ liệu độ trễ tức thì vào TimescaleDB hypertable `probe_results`.
  - Cung cấp luồng Server-Sent Events (SSE) `/metrics/stream` để Dashboard cập nhật biểu đồ không cần F5.

### 4.3 Capacity Advisor (`services/capacity-advisor` — Port 3004)
- **Công nghệ:** Node.js, PostgreSQL client, Thống kê toán học.
- **Nhiệm vụ:**
  - Chạy vòng lặp điều khiển tự trị (Control Loop) mỗi 3 giây.
  - Lấy các mẫu đo độ trễ từ TimescaleDB trong khung trượt 30 giây gần nhất.
  - Thực thi thuật toán hai tầng (Tầng 1: Xung trễ tức thì $\Delta L$; Tầng 2: Hệ số góc độ dốc $S$).
  - Tự động điều chỉnh biến `admissionRate` và kích hoạt sang Traffic Gateway (`PUT /api/config/admission-rate`).
  - Ghi nhật ký mọi quyết định ra bảng `advisor_decisions` để minh bạch thông tin vận hành.

### 4.4 Alert Service (`services/alert-service` — Port 3005)
- **Công nghệ:** Node.js, MongoDB, Telegraf / Telegram Bot API.
- **Nhiệm vụ:**
  - Tiếp nhận các sự kiện cảnh báo bất thường (`CRITICAL`, `WARNING`).
  - Tự động định dạng tin nhắn và đẩy thông báo tức thì vào nhóm Telegram của đội ngũ DevOps nhà trường.
  - Quản lý trạng thái xử lý cảnh báo (`acknowledged`).

### 4.5 Dashboard UI (`dashboard/ui` — Port 3000)
- **Công nghệ:** React 18, Vite, Tailwind CSS, Lucide Icons, Chart.js.
- **Nhiệm vụ:**
  - Trang đăng ký sinh viên: Tích hợp phòng chờ ảo mượt mà với hoạt ảnh tiến trình trực quan (#4 $\to$ #0).
  - Trang quản trị DevOps: Hiển thị 4 đồ thị thời gian thực (Latency P95/P99, Admission Rate, Hàng đợi, Danh sách Microservices), thanh điều khiển tốc độ thủ công (Manual Override) và bộ công cụ reset dữ liệu demo.

---

## 5. Chiến lược lưu trữ đa mô hình (Polyglot Persistence)

Hệ thống kết hợp 4 công nghệ cơ sở dữ liệu chuyên biệt để đạt hiệu năng tối ưu:

| Loại CSDL | Port | Đại diện | Nhiệm vụ chuyên biệt |
| :--- | :--- | :--- | :--- |
| **In-Memory Key-Value** | `6379` | **Redis** | Lưu trữ hàng đợi xếp hàng Sorted Set tốc độ mili-giây, lưu trạng thái vé `ticketId` và khóa thông hành `passToken` kèm TTL tự hủy. |
| **Time-Series Database** | `5432` | **TimescaleDB** | Lưu trữ hàng triệu bản ghi đo đạc độ trễ từ Probe Engine theo chuỗi thời gian, hỗ trợ tính toán aggregate cực nhanh. |
| **Relational Database** | `5433` | **PostgreSQL** | Lưu trữ nhật ký kiểm toán quyết định của thuật toán (`advisor_decisions`) và bảng tham số cấu hình ngưỡng. |
| **Document Database** | `27017` & `27018` | **MongoDB** | Lưu trữ dữ liệu nghiệp vụ khóa học, đăng ký của sinh viên (`registry-service`) và kho lịch sử cảnh báo (`alert-service`). |

---

## 6. Giải thuật điều khiển tự trị hai tầng (Dual-Layer Control Algorithm)

Thuật toán của Capacity Advisor là trái tim của EduPulse, hoạt động theo mô hình điều khiển hồi tiếp thích ứng:

$$\text{Admission Rate}_{t+1} = \mathcal{F}(\text{Admission Rate}_t, \text{Latency}_t, \text{Slope}_t)$$

### 6.1 Tầng 1 — Phát hiện Xung Trễ Đột Biến (Instant Gradient Detection)
- Tính độ tăng trễ giữa hai chu kỳ gần nhất:
  $$\Delta L = L_t - L_{t-1}$$
- Nếu $\frac{\Delta L}{L_{t-1}} > 100\%$ hoặc $L_t > 400\text{ ms}$:
  - Kích hoạt chế độ **Phanh khẩn cấp (Emergency Brake)**.
  - Hạ tốc độ tiếp nhận ngay lập tức về mức sàn an toàn: $Rate_{new} = Rate_{min} = 10\text{ req/s}$.
  - Gửi tín hiệu báo động đỏ sang `alert-service` đẩy thông báo Telegram.

### 6.2 Tầng 2 — Phân Tích Độ Dốc Xu Hướng (Linear Slope Trend Analysis)
- Áp dụng phương pháp bình phương tối thiểu (Ordinary Least Squares) trên $N$ điểm dữ liệu độ trễ trong 30 giây:
  $$S = \frac{N \sum (t_i L_i) - (\sum t_i)(\sum L_i)}{N \sum t_i^2 - (\sum t_i)^2}$$
- **Quy tắc điều tiết:**
  - Nếu $S > 0.5$ (Độ trễ đang có xu hướng tăng lũy tiến): Giảm tốc độ $Rate_{new} = Rate_{current} \times 0.8$.
  - Nếu $-0.2 \le S \le 0.5$ (Hệ thống cân bằng, ổn định): Giữ nguyên $Rate_{new} = Rate_{current}$.
  - Nếu $S < -0.2$ và $L_{avg} < 80\text{ ms}$ (Backend đã giải tỏa tải, đang rảnh): Mở rộng van $Rate_{new} = \min(Rate_{max}, Rate_{current} \times 1.15)$.

---

## 7. Bảo mật & Cơ chế chống gian lận (Security & Anti-Cheating)

1. **Chống vượt hàng đợi (Anti-Bypass Queue):**
   - Mọi request gửi tới `/api/register` đều bị kiểm tra `passToken`. Nếu không có hoặc token không khớp trong Redis $\to$ Trả về `403 Forbidden`.
2. **Khóa thông hành dùng một lần (One-Time / Ephemeral Token):**
   - Token chỉ có hiệu lực 60 giây và tự hủy ngay sau khi lệnh đăng ký môn hoàn tất thành công.
3. **Chống spam đăng ký trùng (Duplicate Registration Prevention):**
   - Áp dụng MongoDB Compound Unique Index `{ studentId: 1, courseId: 1 }` tại tầng backend, ngăn chặn hoàn toàn việc một sinh viên cố ý gửi nhiều request song song để chiếm 2 chỗ cùng lúc.

---

## 8. Khả năng chịu lỗi & Suy thoái mềm (Fault-Tolerance & Graceful Degradation)

- **Khi Redis gặp sự cố (Fallback Mode):**  
  `traffic-gateway` được tích hợp middleware fallback. Nếu kết nối Redis bị gián đoạn, gateway tự động chuyển sang chế độ dự phòng bằng In-Memory Buffer cục bộ của tiến trình Node.js để sinh viên không bị gián đoạn hoàn toàn.
- **Khi Capacity Advisor dừng hoạt động:**  
  Traffic Gateway duy trì tốc độ an toàn đã cấu hình gần nhất (Last Known Good Rate), đảm bảo luồng đăng ký vẫn tiếp tục bình thường.
- **Cách ly tài nguyên (Docker Containerization):**  
  Mỗi phân hệ chạy trong container riêng biệt, giới hạn bộ nhớ và CPU, loại trừ hoàn toàn rủi ro một phân hệ bị quá tải làm treo cả máy chủ.

