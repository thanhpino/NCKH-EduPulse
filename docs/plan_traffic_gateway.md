# Traffic Gateway — Coding Plan (Tuần 3)
## Chia việc cho 2 người: BRO (bạn) + A (teammate)

---

## Hiện trạng code

File `services/traffic-gateway/src/index.js` hiện tại đã có **bản skeleton v1** gồm:
- ✅ `/api/queue/join` — ZADD vào Redis Sorted Set
- ✅ `/api/queue/status/:ticketId` — ZRANK kiểm tra vị trí
- ✅ `/api/queue/process` — Admin trigger admit batch
- ✅ `/api/config/admission-rate` — Capacity Advisor điều chỉnh rate
- ✅ `/api/queue/stats` — Thống kê queue
- ✅ `/health` — Healthcheck

## Vấn đề cần fix (so với kiến trúc Batch + TTL đã thiết kế)

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | Chưa có **Batch Admission tự động** — hiện phải gọi POST /process bằng tay | 🔴 Critical |
| 2 | Chưa có **Token TTL tự hủy** — token hết hạn nhưng không admit người kế | 🔴 Critical |
| 3 | Chưa **forward request** đến Mock Backend khi admitted | 🔴 Critical |
| 4 | Chưa có **Redis fallback** (pass-through khi Redis chết) | 🟡 Important |
| 5 | Queue dùng 1 key chung — chưa tách theo **courseId** | 🟡 Important |
| 6 | Chưa tracking **completedCount, expiredCount** | 🟢 Nice-to-have |
| 7 | Chưa có **unit test** | 🟡 Important |

---

## Kiến trúc file mới (refactor)

```
services/traffic-gateway/
├── src/
│   ├── index.js            ← Entry point + Express routes (BRO)
│   ├── queue.js            ← Redis queue operations (A)
│   ├── token.js            ← Token create/verify/expire (A)
│   ├── admission.js        ← Batch admission loop + auto-admit (BRO)
│   ├── proxy.js            ← Forward request đến Mock Backend (BRO)
│   ├── fallback.js         ← Redis fallback logic (BRO)
│   └── config.js           ← Constants + env vars (AI chung)
├── test/
│   └── gateway.test.js     ← Integration test (cùng làm cuối)
├── package.json
└── Dockerfile
```

---

## Phân chia công việc

### 🧑 BRO (bạn) — Phần "Điều phối + Forward"

#### Task B1: `src/config.js` — Constants (15 phút)
```js
// Tất cả config tập trung 1 chỗ
module.exports = {
  PORT: process.env.PORT || 3002,
  REDIS_URL: process.env.REDIS_URL || 'redis://redis-gateway:6379',
  MOCK_BACKEND_URL: process.env.MOCK_BACKEND_URL || 'http://mock-backend:3010',
  
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 50,
  TOKEN_TTL: parseInt(process.env.TOKEN_TTL) || 180,        // 3 phút
  ADMISSION_INTERVAL: parseInt(process.env.ADMISSION_INTERVAL) || 2000, // 2 giây
  QUEUE_PREFIX: 'edupulse:queue:',         // edupulse:queue:{courseId}
  TOKEN_PREFIX: 'edupulse:token:',         // edupulse:token:{ticketId}
  ACTIVE_SET_PREFIX: 'edupulse:active:',   // edupulse:active:{courseId}
};
```

#### Task B2: `src/admission.js` — Auto Batch Admission (2-3h)
```
Chức năng:
- startAdmissionLoop()
    → setInterval mỗi ADMISSION_INTERVAL (2s)
    → Gọi admitBatch() cho mỗi courseId đang có queue

- admitBatch(courseId)
    1. activeCount = đếm token active cho courseId
    2. slotsAvailable = BATCH_SIZE - activeCount
    3. Nếu slotsAvailable <= 0 → skip
    4. candidates = queue.getNextBatch(courseId, slotsAvailable)
    5. Cho mỗi candidate:
       - token.create(ticketId, courseId)
       - queue.dequeue(ticketId, courseId)
    6. Log: "Admitted 5 students for CS101 (active: 50/50)"

- adjustBatchSize(newSize) — Capacity Advisor gọi 
```

#### Task B3: `src/proxy.js` — Forward đến Mock Backend (1-2h)
```
Chức năng:
- forwardRegistration(studentId, courseId)
    1. Gọi POST http://mock-backend:3010/api/register
       body: { studentId, courseId }
    2. Nếu thành công → return { success: true, data }
    3. Nếu thất bại → return { success: false, error }
```

#### Task B4: `src/fallback.js` — Redis Fallback (1h)
```
Chức năng:
- isRedisAlive() — ping Redis, return true/false
- Nếu Redis chết → Gateway chuyển sang pass-through mode
  → Forward trực tiếp đến Mock Backend (không qua queue)
  → Log warning: "⚠️ Redis unavailable, pass-through mode"
```

#### Task B5: `src/index.js` — Refactor Routes (2-3h)
```
Routes cần có:
POST /api/enqueue          ← SV xin vào hàng (gọi queue.enqueue)
GET  /api/queue/status/:id ← Kiểm tra vị trí (gọi queue.getPosition)
POST /api/register         ← SV có token → verify → forward → mock-backend
GET  /api/queue/stats      ← Dashboard lấy thống kê
PUT  /api/config/rate      ← Capacity Advisor điều chỉnh
GET  /health               ← Healthcheck + redis status

Flow chính POST /api/register:
  1. Nhận { studentId, courseId, ticketId }
  2. token.verify(ticketId) → nếu hết hạn → 403
  3. proxy.forwardRegistration(studentId, courseId)
  4. Nếu thành công → token.revoke(ticketId)
  5. Return kết quả
```

---

### 👨‍💻 A (teammate) — Phần "Redis Operations"

#### Task A1: `src/queue.js` — Redis Queue CRUD (2-3h)
```js
// Tất cả operations trên Redis Sorted Set
module.exports = (redis, config) => ({
  
  // Thêm SV vào hàng đợi (ZADD theo timestamp)
  async enqueue(ticketId, courseId) {
    const key = config.QUEUE_PREFIX + courseId;
    const score = Date.now();
    await redis.zadd(key, score, ticketId);
    return score;
  },

  // Lấy vị trí trong hàng đợi (0-indexed → +1)
  async getPosition(ticketId, courseId) {
    const key = config.QUEUE_PREFIX + courseId;
    const rank = await redis.zrank(key, ticketId);
    return rank !== null ? rank + 1 : null;  // null = không trong queue
  },

  // Xóa khỏi hàng đợi (khi được admit hoặc hết hạn)
  async dequeue(ticketId, courseId) {
    const key = config.QUEUE_PREFIX + courseId;
    return await redis.zrem(key, ticketId);
  },

  // Lấy N người đầu tiên (batch admit)
  async getNextBatch(courseId, count) {
    const key = config.QUEUE_PREFIX + courseId;
    return await redis.zrange(key, 0, count - 1);
  },

  // Đếm tổng người trong hàng đợi
  async getQueueLength(courseId) {
    const key = config.QUEUE_PREFIX + courseId;
    return await redis.zcard(key);
  },

  // Lấy tất cả courseId đang có queue (để admission loop iterate)
  async getActiveCourseIds() {
    const keys = await redis.keys(config.QUEUE_PREFIX + '*');
    return keys.map(k => k.replace(config.QUEUE_PREFIX, ''));
  },
});
```

#### Task A2: `src/token.js` — Token Manager (2-3h)
```js
// Token lifecycle: create → verify → revoke/expire
module.exports = (redis, config) => ({

  // Tạo token cho SV đã được admit (TTL 3 phút)
  async create(ticketId, courseId) {
    const key = config.TOKEN_PREFIX + ticketId;
    const data = {
      courseId,
      status: 'admitted',
      admittedAt: new Date().toISOString(),
    };
    await redis.set(key, JSON.stringify(data), 'EX', config.TOKEN_TTL);
    
    // Track active tokens per course (để đếm activeCount)
    const activeKey = config.ACTIVE_SET_PREFIX + courseId;
    await redis.sadd(activeKey, ticketId);
    return data;
  },

  // Kiểm tra token còn hạn không
  async verify(ticketId) {
    const key = config.TOKEN_PREFIX + ticketId;
    const data = await redis.get(key);
    if (!data) return null;  // hết hạn hoặc không tồn tại
    return JSON.parse(data);
  },

  // Xóa token (sau khi SV đăng ký xong)
  async revoke(ticketId, courseId) {
    const key = config.TOKEN_PREFIX + ticketId;
    await redis.del(key);
    
    // Xóa khỏi active set
    const activeKey = config.ACTIVE_SET_PREFIX + courseId;
    await redis.srem(activeKey, ticketId);
  },

  // Đếm số token đang active cho 1 course
  async getActiveCount(courseId) {
    const activeKey = config.ACTIVE_SET_PREFIX + courseId;
    return await redis.scard(activeKey);
  },

  // Cleanup expired tokens khỏi active set
  // (Chạy định kỳ vì Redis EXPIRE chỉ xóa key, không xóa khỏi Set)
  async cleanupExpired(courseId) {
    const activeKey = config.ACTIVE_SET_PREFIX + courseId;
    const members = await redis.smembers(activeKey);
    for (const ticketId of members) {
      const exists = await redis.exists(config.TOKEN_PREFIX + ticketId);
      if (!exists) {
        await redis.srem(activeKey, ticketId);
      }
    }
  },
});
```

---

## Quy trình làm việc hôm nay

### Git workflow
```bash
# Cả 2 người đều checkout từ develop
git checkout develop
git pull origin develop
git checkout -b feature/traffic-gateway
```

### Thứ tự code (có dependency)
```
Bước 1: BRO làm config.js (15 phút) → push → A pull
          ↓
Bước 2: Song song
         BRO: admission.js + proxy.js + fallback.js
         A:   queue.js + token.js
          ↓
Bước 3: BRO viết index.js (import tất cả modules lại)
          ↓
Bước 4: Cùng test thủ công bằng curl/Postman
          ↓
Bước 5: Cùng viết integration test
```

### Test thủ công (sau khi code xong)
```bash
# 1. Seed data cho mock-backend
curl -X POST http://localhost:3010/api/seed

# 2. SV xin vào hàng đợi
curl -X POST http://localhost:3002/api/enqueue \
  -H "Content-Type: application/json" \
  -d '{"studentId":"SV001","courseId":"CS101"}'
# → Expect: { ticketId, position: 1, status: "waiting" }

# 3. Kiểm tra vị trí
curl http://localhost:3002/api/queue/status/{ticketId}
# → Expect: { position: 1, status: "waiting" }

# 4. Chờ 2 giây (admission loop tự chạy)
# → Token tự động được tạo

# 5. Kiểm tra lại → đã được admit
curl http://localhost:3002/api/queue/status/{ticketId}
# → Expect: { status: "admitted", token: "..." }

# 6. Dùng token để đăng ký
curl -X POST http://localhost:3002/api/register \
  -H "Content-Type: application/json" \
  -d '{"studentId":"SV001","courseId":"CS101","ticketId":"{ticketId}"}'
# → Expect: forward đến mock-backend → { message: "Registration successful" }

# 7. Xem stats
curl http://localhost:3002/api/queue/stats
# → Expect: { queueLength, activeCount, completedCount }
```

---

## Mục tiêu cuối ngày hôm nay

| # | Mục tiêu | Ai |
|---|----------|----|
| 1 | ✅ config.js hoàn chỉnh | BRO |
| 2 | ✅ queue.js — enqueue, dequeue, getPosition, getNextBatch | A |
| 3 | ✅ token.js — create, verify, revoke, getActiveCount, cleanupExpired | A |
| 4 | ✅ admission.js — admitBatch + startAdmissionLoop (auto mỗi 2s) | BRO |
| 5 | ✅ proxy.js — forward đến mock-backend | BRO |
| 6 | ✅ index.js — refactor routes, import modules | BRO |
| 7 | ✅ Test thủ công: enqueue → auto admit → register → success | Cùng |

---

*Plan created: 2026-08-29*
