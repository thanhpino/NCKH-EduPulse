# EduPulse — Development Plan (Coding Phase)
## Từ tuần 3 trở đi — sau khi hoàn thành Skeleton + Diagrams

---

## Tổng quan tiến độ

```
✅ Tuần 1:  Project Skeleton + Mock Backend + Registry Service + CI/CD
✅ Tuần 2:  ERD + Use Case + Microservice Architecture Diagrams
⏳ Tuần 3-4:  ★ Traffic Gateway (BỘ NÃO CHÍNH)
⏳ Tuần 5:    Student Registration UI (DEMO FRONTEND)
⏳ Tuần 6-7:  Probe Engine + Capacity Advisor (FEEDBACK LOOP)
⏳ Tuần 8:    Alert Service + Telegram Bot
⏳ Tuần 9-10: Admin Dashboard (MONITORING UI)
⏳ Tuần 11:   Integration Test + Load Test toàn hệ thống
⏳ Tuần 12:   Polish + Bug fix + Demo rehearsal
⏳ Tuần 13-14: Viết báo cáo + Chuẩn bị bảo vệ
```

---

## PHASE 1: Traffic Gateway (Tuần 3-4) ★★★ QUAN TRỌNG NHẤT

> Đây là trái tim của dự án. Nếu phần này chạy tốt = dự án thành công 70%.

### Tuần 3 — Core Queue + Admission Logic

| Task | File | Mô tả | Thời gian |
|------|------|-------|-----------|
| 3.1 | `src/queue.js` | Redis Sorted Set — ZADD/ZRANK/ZREM | 2-3h |
| 3.2 | `src/token.js` | Token Manager — tạo token + TTL (EXPIRE) | 2h |
| 3.3 | `src/admission.js` | Batch Admission — admit N users, sliding window | 3-4h |
| 3.4 | `src/index.js` | Express routes — POST /enqueue, GET /status, POST /admit | 3-4h |
| 3.5 | `src/fallback.js` | Redis fallback — pass-through khi Redis chết | 1-2h |

**Chi tiết từng file:**

#### `src/queue.js` — Hàng đợi Redis
```
Chức năng:
- enqueue(studentId, courseId)    → ZADD queue:{courseId} {timestamp} {studentId}
- getPosition(studentId, courseId) → ZRANK để lấy vị trí
- dequeue(studentId, courseId)    → ZREM xóa khỏi hàng đợi
- getQueueLength(courseId)        → ZCARD đếm tổng
- getNextBatch(courseId, batchSize) → ZRANGE lấy N người đầu tiên
```

#### `src/token.js` — Quản lý Token
```
Chức năng:
- createToken(studentId, courseId)  → SET token:{studentId}:{courseId} + EXPIRE 180s (3 phút)
- verifyToken(studentId, courseId)  → GET token → kiểm tra còn hạn không
- revokeToken(studentId, courseId)  → DEL token
- getActiveCount(courseId)          → Đếm số token đang active
- onTokenExpired(callback)         → Redis Keyspace Notification khi token hết hạn
```

#### `src/admission.js` — Điều tiết Batch
```
Chức năng:
- admitBatch(courseId)
    1. activeCount = getActiveCount(courseId)
    2. slotsAvailable = batchSize - activeCount  
    3. candidates = getNextBatch(courseId, slotsAvailable)
    4. Cho mỗi candidate: createToken() + dequeue()
    5. Return danh sách vừa admit

- Chạy interval mỗi 2 giây (admissionInterval)
- Khi token hết hạn → tự động chạy admitBatch() để lấp slot trống
```

#### API Endpoints (tuần 3):
| Method | Endpoint | Mô tả | Response |
|--------|----------|-------|----------|
| POST | `/api/enqueue` | SV xin vào hàng đợi | `{ position, estimatedWait }` |
| GET | `/api/queue/status/:studentId` | Kiểm tra vị trí + trạng thái | `{ position, status: "waiting"|"admitted"|"completed" }` |
| POST | `/api/register` | SV có token → forward đến Mock Backend | `{ success, registrationId }` |
| GET | `/api/queue/stats` | Thống kê queue (cho Dashboard) | `{ queueLength, activeCount, completedCount }` |
| PUT | `/api/config/rate` | Capacity Advisor gọi để điều chỉnh batch size | `{ newBatchSize }` |
| GET | `/health` | Healthcheck | `{ status, redis, uptime }` |

### Tuần 4 — Test + Edge Cases + Integration

| Task | Mô tả | Thời gian |
|------|-------|-----------|
| 4.1 | Unit test cho queue.js, token.js, admission.js | 3-4h |
| 4.2 | Edge case: token hết hạn → tự admit người kế tiếp | 2h |
| 4.3 | Edge case: Redis chết → fallback pass-through | 2h |
| 4.4 | Integration test: Gateway → Mock Backend → MongoDB | 3h |
| 4.5 | k6 load test qua Gateway (500-1000 VUs) | 2-3h |
| 4.6 | So sánh kết quả: trực tiếp vs qua Gateway | 2h |

**Deliverable cuối tuần 4:**
- Traffic Gateway chạy ổn định
- 1000 VUs qua Gateway → 99%+ thành công
- So sánh rõ ràng Before/After
- Git: merge PR vào develop

---

## PHASE 2: Student Registration UI (Tuần 5)

> Frontend cho sinh viên — đây là thứ thầy nhìn thấy khi demo.

| Task | File | Mô tả | Thời gian |
|------|------|-------|-----------|
| 5.1 | `student-ui/index.html` | Trang đăng ký học phần | 3-4h |
| 5.2 | `student-ui/waiting-room.html` | Giao diện phòng chờ ảo (polling vị trí) | 4-5h |
| 5.3 | `student-ui/style.css` | UI đẹp, responsive, animation | 3h |
| 5.4 | `student-ui/app.js` | Logic gọi API Gateway + auto-refresh | 3h |
| 5.5 | Nginx config | Serve static files + reverse proxy | 1h |

**Giao diện gồm 3 trạng thái:**
```
State 1: CHỌN MÔN HỌC
  → Danh sách môn, slot còn lại
  → Click "Đăng ký" → POST /api/enqueue

State 2: PHÒNG CHỜ ẢO (Waiting Room)
  → "Vị trí: #42 / 847"
  → Progress bar + countdown
  → Polling GET /api/queue/status mỗi 3 giây
  → Khi status = "admitted" → chuyển sang State 3

State 3: ĐĂNG KÝ THÀNH CÔNG
  → Hiện token + countdown 3 phút
  → Click "Xác nhận đăng ký" → POST /api/register
  → Hiện kết quả thành công / thất bại
```

**Deliverable cuối tuần 5:**
- Mở browser → chọn môn → xếp hàng → đăng ký thành công
- Demo được trên trình duyệt (không cần command line)

---

## PHASE 3: Probe Engine + Capacity Advisor (Tuần 6-7)

> Feedback loop tự động — đây là điểm "đột phá" so với dự án khác.

### Tuần 6 — Probe Engine

| Task | File | Mô tả | Thời gian |
|------|------|-------|-----------|
| 6.1 | `src/probes/http-probe.js` | Gửi HTTP request đến Mock Backend, đo latency | 2-3h |
| 6.2 | `src/probes/health-probe.js` | Check /health của tất cả services | 2h |
| 6.3 | `src/storage.js` | Ghi metrics vào TimescaleDB (pg client) | 2-3h |
| 6.4 | `src/scheduler.js` | node-cron chạy probe mỗi 10 giây | 1-2h |
| 6.5 | `src/index.js` | API: GET /api/metrics, GET /api/metrics/latest | 2h |
| 6.6 | DB migration | Tạo bảng `probe_results` trong TimescaleDB | 1h |

#### Schema TimescaleDB:
```sql
CREATE TABLE probe_results (
  id            SERIAL PRIMARY KEY,
  target        VARCHAR(50),        -- 'mock-backend', 'registry-service'
  latency_ms    INTEGER,
  status_code   INTEGER,
  is_healthy    BOOLEAN,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- TimescaleDB hypertable cho time-series query nhanh
SELECT create_hypertable('probe_results', 'created_at');
```

### Tuần 7 — Capacity Advisor

| Task | File | Mô tả | Thời gian |
|------|------|-------|-----------|
| 7.1 | `src/analyzer.js` | Đọc metrics từ TimescaleDB, tính trung bình latency | 2-3h |
| 7.2 | `src/slope.js` | Linear regression trên latency → phát hiện xu hướng tăng | 3-4h |
| 7.3 | `src/advisor.js` | Logic quyết định: tăng/giảm/giữ admission rate | 3-4h |
| 7.4 | `src/index.js` | API + scheduler: mỗi 30s phân tích + gọi Gateway PUT /api/config/rate | 2h |
| 7.5 | DB migration | Tạo bảng `advisor_decisions` trong PostgreSQL | 1h |

#### Logic Advisor:
```
Mỗi 30 giây:
  1. Lấy latency 5 phút gần nhất từ TimescaleDB
  2. Tính slope (xu hướng)
  3. Nếu slope > 0 (latency tăng)    → GIẢM batch size
  4. Nếu slope < 0 (latency giảm)    → TĂNG batch size
  5. Nếu latency > 500ms             → GIẢM MẠNH batch size
  6. Nếu latency < 100ms             → TĂNG batch size
  7. Gọi PUT /api/config/rate gửi cho Gateway
  8. Ghi quyết định vào PostgreSQL (audit log)
```

**Deliverable cuối tuần 7:**
- Probe tự đo latency mỗi 10s → ghi vào TimescaleDB
- Advisor tự phân tích → điều chỉnh Gateway batch size
- Feedback loop hoàn chỉnh: Probe → Advisor → Gateway
- Kiểm chứng: tăng tải → latency tăng → advisor tự giảm rate → latency ổn định

---

## PHASE 4: Alert Service (Tuần 8)

| Task | File | Mô tả | Thời gian |
|------|------|-------|-----------|
| 8.1 | `src/index.js` | Express API: POST /api/alerts | 2h |
| 8.2 | `src/telegram.js` | Gửi message qua Telegram Bot API | 2-3h |
| 8.3 | `src/storage.js` | Lưu alert history vào MongoDB (Alert) | 1-2h |
| 8.4 | `src/rules.js` | Alert rules: latency > 1s, error rate > 10%, queue > 500 | 2-3h |
| 8.5 | Tạo Telegram Bot | BotFather → lấy token → config env | 1h |

**Deliverable cuối tuần 8:**
- Khi hệ thống quá tải → Telegram bot gửi tin nhắn cảnh báo
- Alert history lưu trong MongoDB

---

## PHASE 5: Admin Dashboard (Tuần 9-10)

> Giao diện monitoring real-time — thầy sẽ nhìn vào đây khi demo.

### Tuần 9 — Layout + Charts cơ bản

| Task | Mô tả | Thời gian |
|------|-------|-----------|
| 9.1 | Dashboard layout: sidebar + grid cards | 3-4h |
| 9.2 | Queue Status card (real-time) | 2-3h |
| 9.3 | Latency chart (Chart.js line graph) | 3h |
| 9.4 | Service Health cards (green/red dots) | 2h |
| 9.5 | Auto-refresh mỗi 3 giây (polling) | 1-2h |

### Tuần 10 — Polish + Before/After comparison

| Task | Mô tả | Thời gian |
|------|-------|-----------|
| 10.1 | Before/After comparison view | 3-4h |
| 10.2 | Admission rate gauge (hiện batch size hiện tại) | 2h |
| 10.3 | Alert history timeline | 2-3h |
| 10.4 | Dark mode + responsive + animations | 3-4h |
| 10.5 | "Start Load Test" button (trigger k6 từ UI) | 2-3h |

**Deliverable cuối tuần 10:**
- Admin Dashboard hiển thị toàn bộ metrics real-time
- Nút "Start Load Test" → k6 chạy → charts nhảy số trực tiếp

---

## PHASE 6: Integration + Polish (Tuần 11-12)

### Tuần 11 — Full Integration Test

| Task | Mô tả |
|------|-------|
| 11.1 | Boot toàn bộ 13 containers → smoke test |
| 11.2 | k6 load test: 500 → 1000 → 2000 VUs |
| 11.3 | Kiểm tra feedback loop: Probe → Advisor → Gateway tự điều chỉnh |
| 11.4 | Kiểm tra token TTL: offline user → token hết hạn → admit người kế |
| 11.5 | Kiểm tra Redis fallback: stop Redis → Gateway vẫn chạy (pass-through) |
| 11.6 | Ghi lại KẾT QUẢ bằng số liệu (success rate, p95 latency, throughput) |

### Tuần 12 — Polish + Demo Rehearsal

| Task | Mô tả |
|------|-------|
| 12.1 | Fix bugs từ integration test |
| 12.2 | Tối ưu UI animations, loading states |
| 12.3 | Chạy thử demo 3 bước (trước mặt bạn cùng nhóm) |
| 12.4 | Chuẩn bị bộ data demo (courses, students) sẵn sàng |
| 12.5 | Viết script demo: từng bước click gì, nói gì |

---

## PHASE 7: Báo cáo + Bảo vệ (Tuần 13-14)

| Task | Mô tả |
|------|-------|
| 13.1 | Viết báo cáo khóa luận |
| 13.2 | Slide bảo vệ (15-20 slides) |
| 13.3 | Chuẩn bị 7 câu trả lời phản biện |
| 13.4 | Demo rehearsal lần cuối |

---

## Tổng kết thời gian ước lượng

| Phase | Nội dung | Tuần | Giờ code ước tính |
|-------|----------|------|-------------------|
| 1 | Traffic Gateway | 3-4 | ~25-30h |
| 2 | Student UI | 5 | ~15h |
| 3 | Probe + Advisor | 6-7 | ~25h |
| 4 | Alert Service | 8 | ~10h |
| 5 | Dashboard | 9-10 | ~25h |
| 6 | Integration + Polish | 11-12 | ~15h |
| 7 | Báo cáo + Bảo vệ | 13-14 | ~20h |
| **Tổng** | | **12 tuần** | **~135h** |

---

*Cập nhật: 2026-08-24*
