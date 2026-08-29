    # EduPulse — Diagrams & API Reference (Dùng cho Lucidchart)

    ## 1. ERD (Entity Relationship Diagram)

    ### 📦 Database 1: `mongo-mock` (Mock Backend — Port 27019)

    #### Collection: `courses`
    | Field       | Type   | Constraint       | Mô tả                    |
    |-------------|--------|------------------|---------------------------|
    | _id         | ObjectId | PK, auto        |                           |
    | courseId    | String | required         | Mã môn học (CS101...)     |
    | courseName | String | required         | Tên môn học               |
    | maxSlots   | Number | default: 40      | Số chỗ tối đa            |
    | enrolled   | Number | default: 0       | Số đã đăng ký            |

    #### Collection: `registrations`
    | Field       | Type   | Constraint       | Mô tả                    |
    |-------------|--------|------------------|---------------------------|
    | _id         | ObjectId | PK, auto        |                           |
    | studentId  | String | required         | MSSV                      |
    | courseId    | String | required         | Mã môn học                |
    | timestamp  | Date   | default: now     | Thời điểm đăng ký        |

    **Relationship:** `registrations.courseId` → `courses.courseId` (N:1)

    ---

    ### 📦 Database 2: `mongo-registry` (Registry Service — Port 27017)

    #### Collection: `courses`
    | Field            | Type   | Constraint                        | Mô tả                     |
    |------------------|--------|-----------------------------------|----------------------------|
    | _id              | ObjectId | PK, auto                        |                            |
    | courseId         | String | required, **unique**              | Mã môn học                 |
    | courseName      | String | required                          | Tên môn học                |
    | maxSlots        | Number | required                          | Số chỗ tối đa             |
    | currentEnrolled | Number | default: 0                        | Số đã đăng ký (atomic)    |
    | status          | String | enum: OPEN/FULL/CLOSED, default: OPEN | Trạng thái môn học   |
    | createdAt       | Date   | auto (timestamps)                 |                            |
    | updatedAt       | Date   | auto (timestamps)                 |                            |

    #### Collection: `registrations`
    | Field       | Type   | Constraint                           | Mô tả                     |
    |-------------|--------|--------------------------------------|----------------------------|
    | _id         | ObjectId | PK, auto                           |                            |
    | studentId  | String | required                             | MSSV                       |
    | courseId    | String | required                             | Mã môn học                 |
    | status     | String | enum: SUCCESS/CANCELLED, default: SUCCESS | Trạng thái         |
    | createdAt  | Date   | auto (timestamps)                    |                            |
    | updatedAt  | Date   | auto (timestamps)                    |                            |

    **Index:** Compound Unique Index `{ studentId: 1, courseId: 1 }` — chống đăng ký trùng  
    **Relationship:** `registrations.courseId` → `courses.courseId` (N:1)

    ---

    ### 📦 Database 3: `redis-gateway` (Traffic Gateway — Port 6379)

    | Key Pattern                    | Type         | Mô tả                              |
    |-------------------------------|--------------|-------------------------------------|
    | `queue:{courseId}`            | Sorted Set   | Hàng đợi FIFO, score = timestamp   |
    | `ticket:{ticketId}`          | String (TTL) | Token xếp hàng, expire sau 5 phút  |
    | `admission_rate`             | String       | Tốc độ admission hiện tại          |

    ---

    ### 📦 Database 4: `timescaledb` (Probe Engine — Port 5432)

    #### Table: `probe_results` (Hypertable)
    | Column         | Type        | Constraint    | Mô tả                     |
    |----------------|-------------|---------------|----------------------------|
    | id             | SERIAL      | PK            |                            |
    | target_url     | VARCHAR     | NOT NULL      | URL được đo                |
    | response_time  | INTEGER     | NOT NULL      | Latency (ms)               |
    | status_code    | INTEGER     |               | HTTP status code           |
    | is_error       | BOOLEAN     | default false | Có lỗi không               |
    | created_at     | TIMESTAMPTZ | default now   | Thời điểm đo              |

    ---

    ### 📦 Database 5: `postgres-advisor` (Capacity Advisor — Port 5433)

    #### Table: `advisor_decisions`
    | Column          | Type        | Constraint    | Mô tả                         |
    |-----------------|-------------|---------------|--------------------------------|
    | id              | SERIAL      | PK            |                                |
    | current_rate    | INTEGER     | NOT NULL      | Admission rate hiện tại        |
    | recommended_rate| INTEGER     | NOT NULL      | Rate đề xuất                   |
    | avg_latency     | FLOAT       |               | Latency trung bình             |
    | slope           | FLOAT       |               | Độ dốc xu hướng tải            |
    | created_at      | TIMESTAMPTZ | default now   |                                |

    ---

    ### 📦 Database 6: `mongo-alert` (Alert Service — Port 27018)

    #### Collection: `alerts`
    | Field       | Type   | Constraint                              | Mô tả                     |
    |-------------|--------|-----------------------------------------|----------------------------|
    | _id         | ObjectId | PK, auto                              |                            |
    | type        | String | enum: WARNING/CRITICAL                  | Mức độ cảnh báo            |
    | service     | String | required                                | Service gây cảnh báo       |
    | message     | String | required                                | Nội dung cảnh báo          |
    | resolved    | Boolean| default: false                          | Đã xử lý chưa             |
    | createdAt   | Date   | auto (timestamps)                       |                            |

    ---

    ## 2. Use Case Diagram

    ### Actors
    1. **Sinh viên (Student)** — Người dùng cuối
    2. **Admin** — Quản trị viên hệ thống
    3. **System (Scheduler/Cron)** — Tác vụ tự động

    ### Use Cases

    #### Actor: Sinh viên
    | # | Use Case                        | Service liên quan      |
    |---|----------------------------------|------------------------|
    | 1 | Đăng ký môn học                 | Mock Backend / Gateway |
    | 2 | Xếp hàng chờ (Virtual Queue)   | Traffic Gateway        |
    | 3 | Kiểm tra vị trí hàng đợi       | Traffic Gateway        |
    | 4 | Xem trạng thái hệ thống (Public Status) | Dashboard     |

    #### Actor: Admin
    | # | Use Case                        | Service liên quan      |
    |---|----------------------------------|------------------------|
    | 5 | Đăng ký target cần giám sát    | Registry Service       |
    | 6 | Xem danh sách khóa học         | Registry Service       |
    | 7 | Xem Dashboard giám sát         | Dashboard              |
    | 8 | Nhận cảnh báo Telegram         | Alert Service          |
    | 9 | Cấu hình admission rate        | Traffic Gateway        |
    | 10| Xem lịch sử advisor decisions  | Capacity Advisor       |
    | 11| Seed dữ liệu mẫu              | Mock Backend / Registry|

    #### Actor: System (Tự động)
    | # | Use Case                        | Service liên quan      |
    |---|----------------------------------|------------------------|
    | 12| Probe đo latency định kỳ       | Probe Engine           |
    | 13| Phân tích xu hướng tải          | Capacity Advisor       |
    | 14| Tự động điều chỉnh admission   | Advisor → Gateway      |
    | 15| Gửi cảnh báo phân cấp          | Alert Service          |

    ### Relationships giữa Use Cases
    - UC1 `<<include>>` UC2 (khi hệ thống quá tải, đăng ký tự chuyển sang xếp hàng)
    - UC12 `<<include>>` UC13 (probe results feed vào advisor analysis)
    - UC13 `<<include>>` UC14 (advisor tự động ra lệnh gateway)
    - UC14 `<<extend>>` UC15 (nếu tải vượt ngưỡng → trigger cảnh báo)

    ---

    ## 3. API Endpoints — Toàn bộ hệ thống

    ### Service 1: Mock Backend `:3010`
    | Method | Endpoint             | Mô tả                           | Request Body                      | Response                     |
    |--------|----------------------|----------------------------------|-----------------------------------|------------------------------|
    | GET    | `/health`            | Health check                     | —                                 | `{ status, service, timestamp }` |
    | GET    | `/api/courses`       | Danh sách môn học                | —                                 | `[{ courseId, courseName, maxSlots, enrolled }]` |
    | POST   | `/api/register`      | Đăng ký môn học (cố tình chậm)  | `{ studentId, courseId }`         | `201: { message, studentId, courseId, position }` |
    | POST   | `/api/seed`          | Reset + tạo dữ liệu mẫu        | —                                 | `{ message, count }` |
    | POST   | `/api/test-register` | Test tự động 13 case             | —                                 | Streaming NDJSON |

    ### Service 2: Registry Service `:3001`
    | Method | Endpoint         | Mô tả                           | Request Body                      | Response                     |
    |--------|------------------|----------------------------------|-----------------------------------|------------------------------|
    | GET    | `/health`        | Health check                     | —                                 | `{ status, service, timestamp }` |
    | GET    | `/api/courses`   | Danh sách khóa học               | —                                 | `[{ courseId, courseName, maxSlots, currentEnrolled, status }]` |
    | POST   | `/api/enroll`    | Đăng ký (atomic update)          | `{ studentId, courseId }`         | `201: { message, data }` |
    | POST   | `/api/seed`      | Reset + tạo dữ liệu mẫu        | —                                 | `{ message }` |

    ### Service 3: Traffic Gateway `:3002` (Tuần 2 — chưa code)
    | Method | Endpoint                | Mô tả                           | Request Body                      | Response                     |
    |--------|-------------------------|----------------------------------|-----------------------------------|------------------------------|
    | GET    | `/health`               | Health check                     | —                                 | `{ status, service }` |
    | POST   | `/api/queue/join`       | Xếp hàng đăng ký                | `{ studentId, courseId }`         | `{ ticketId, position, estimatedWait }` |
    | GET    | `/api/queue/status/:ticketId` | Kiểm tra vị trí hàng đợi  | —                                 | `{ position, estimatedWait, status }` |
    | POST   | `/api/queue/admit`      | Cho phép vào đăng ký (internal) | `{ ticketId }`                    | `{ allowed, forwardUrl }` |
    | GET    | `/api/queue/stats`      | Thống kê hàng đợi               | —                                 | `{ totalInQueue, admissionRate, avgWait }` |
    | PUT    | `/api/config/rate`      | Cập nhật admission rate          | `{ rate }`                        | `{ message, newRate }` |

    ### Service 4: Probe Engine `:3003` (Tuần 3-4)
    | Method | Endpoint              | Mô tả                           | Request Body                      | Response                     |
    |--------|-----------------------|----------------------------------|-----------------------------------|------------------------------|
    | GET    | `/health`             | Health check                     | —                                 | `{ status, service }` |
    | GET    | `/api/metrics`        | Lấy metrics gần nhất            | Query: `?minutes=5`               | `[{ target_url, response_time, status_code, created_at }]` |
    | GET    | `/api/metrics/summary`| Tổng hợp metrics                 | Query: `?minutes=30`              | `{ avg_latency, p95, error_rate }` |

    ### Service 5: Capacity Advisor `:3004` (Tuần 4-5)
    | Method | Endpoint              | Mô tả                           | Request Body                      | Response                     |
    |--------|-----------------------|----------------------------------|-----------------------------------|------------------------------|
    | GET    | `/health`             | Health check                     | —                                 | `{ status, service }` |
    | GET    | `/api/analysis`       | Phân tích xu hướng hiện tại      | —                                 | `{ slope, trend, recommended_rate }` |
    | GET    | `/api/decisions`      | Lịch sử quyết định               | Query: `?limit=20`               | `[{ current_rate, recommended_rate, slope, created_at }]` |

    ### Service 6: Alert Service `:3005` (Tuần 4-5)
    | Method | Endpoint              | Mô tả                           | Request Body                      | Response                     |
    |--------|-----------------------|----------------------------------|-----------------------------------|------------------------------|
    | GET    | `/health`             | Health check                     | —                                 | `{ status, service }` |
    | POST   | `/api/alerts`         | Tạo cảnh báo mới                 | `{ type, service, message }`     | `201: { alert }` |
    | GET    | `/api/alerts`         | Danh sách cảnh báo               | Query: `?resolved=false`          | `[{ type, service, message, resolved, createdAt }]` |
    | PATCH  | `/api/alerts/:id`     | Đánh dấu đã xử lý               | `{ resolved: true }`              | `{ updated alert }` |

    ### Service 7: Dashboard `:3000`
    | Type   | Endpoint     | Mô tả                           |
    |--------|-------------|----------------------------------|
    | Page   | `/`         | Admin Dashboard (Chart.js)       |
    | Page   | `/status`   | Public Status Page (xem hàng đợi)|

    ---

    ## 4. Hướng dẫn vẽ trong Lucidchart

    ### Bước 1 — ERD
    1. Mở Lucidchart → New → Entity Relationship Diagram
    2. Tạo 6 khối DB, mỗi khối chứa tables/collections như trên
    3. Vẽ đường nối N:1 giữa `registrations` → `courses` trong cả Mock và Registry DB
    4. Dùng màu khác nhau cho mỗi loại DB:
    - 🟠 MongoDB (3 cái)
    - 🔴 Redis (1 cái)
    - 🔵 TimescaleDB (1 cái)
    - 🟢 PostgreSQL (1 cái)

    ### Bước 2 — Use Case Diagram
    1. New → UML Use Case Diagram
    2. Vẽ 3 actors bên trái/phải: Student, Admin, System
    3. Bên trong hệ thống (hình chữ nhật), đặt 15 use case trên
    4. Nối actor → use case bằng đường thẳng
    5. Dùng `<<include>>` và `<<extend>>` cho relationships

    ### Bước 3 — API Table
    1. New → Blank Document
    2. Insert Table, copy nội dung từ Section 3 ở trên
    3. Hoặc tạo tab riêng trong Google Sheets rồi link vào Lucidchart

    ---

    ### Service 8: Cross-Cutting & Management APIs (Toàn bộ 6 Microservices)

    | Method | Endpoint             | Service | Mô tả                           | Request Body | Response |
    |--------|----------------------|---------|----------------------------------|--------------|----------|
    | GET    | `/health`            | Tất cả  | Lấy trạng thái sống của Container| —            | `{ status: "ok", service, timestamp }` |
    | GET    | `/metrics`           | Tất cả  | Xuất chỉ số theo chuẩn Prometheus| —            | Metrics format (text/plain) |
    | GET    | `/api/config`        | Gateway/Advisor | Xem cấu hình cấu trúc runtime | —            | `{ admissionRate, interval, thresholds }` |
    | POST   | `/api/notifications/telegram` | Alert Service | Gửi webhook tin nhắn khẩn | `{ chat_id, text }` | `{ success: true, message_id }` |

    ---

    ## 5. Cấu trúc Use Case Diagram nâng cấp (kèm Cross-Cutting)

    ```
                        ┌────────────────────────────────────────────────────────┐
                        │                  EduPulse System                       │
                        │                                                        │
        🧍                 │    ╭─────────────────╮     <<include>>    ╭──────────╮ │
    Student ──────────────┼───▶│  Đăng ký môn    │───────────────────▶│ Security │ │
                        │    ╰────────┬────────╯                    ╰──────────╯ │
                        │             │                                          │
                        │             │ <<include>>                              │
                        │             ▼                                          │
                        │    ╭─────────────────╮     <<include>>    ╭──────────╮ │
                        │    │  Xếp hàng ảo    │───────────────────▶│ Logging  │ │
                        │    ╰─────────────────╯                    ╰──────────╯ │
                        │                                                        │
        🧍                 │    ╭─────────────────╮                    ╭──────────╮ │    🤖
    DevOps / ─────────────┼───▶│ Theo dõi Metrics│                    │ Telegram │────┼─ Telegram
    SysAdmin             │    ╰─────────────────╯                    │ Bot API  │ │   Service
                        │    ╭─────────────────╮     <<extend>>     ╰────▲─────╯ │
                        │    │ Cấu hình ENV    │                      │          │
                        │    ╰─────────────────╯           ╭──────────┴───────╮  │
                        │                                  │ Phát Cảnh báo   │  │
                        │                                  ╰──────────────────╯  │
                        └────────────────────────────────────────────────────────┘
    ```

