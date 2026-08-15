# EduPulse — Kiến trúc, Tech Stack & Roadmap 14 Tuần
## Hệ thống Giám sát & Điều tiết Tải Chủ động cho Đăng ký Học phần

---

## 1. Định vị đề tài (chốt)

**Vấn đề thật:** Hệ thống đăng ký học phần ở nhiều trường ĐH Việt Nam thường quá tải/sập trong 10-15 phút đầu mở cổng đăng ký do traffic dồn cực đại (burst traffic), gây ảnh hưởng trực tiếp đến quyền lợi học tập của sinh viên. Đây là vấn đề đã được báo chí (VnExpress, Thanh Niên, Kenh14) ghi nhận nhiều lần, một số trường phải xử lý thủ công bằng cách chia khung giờ đăng ký theo khóa.

**Giải pháp:** EduPulse không chỉ giám sát và cảnh báo, mà **chủ động điều tiết tải** bằng cơ chế Virtual Waiting Room (hàng đợi ảo) — tương tự Ticketmaster/Cloudflare Waiting Room dùng khi bán vé sự kiện hot — kết hợp Capacity Advisor tự động điều chỉnh tốc độ admission dựa trên xu hướng tải thời gian thực.

**Điểm khác biệt cốt lõi so với công cụ có sẵn (Uptime Kuma, Datadog):** các công cụ đó chỉ quan sát và báo cáo; EduPulse **can thiệp trực tiếp vào luồng traffic** để ngăn sập xảy ra, không chỉ báo sập sớm hơn.

---

## 2. Kiến trúc hệ thống (6 service, mỗi service 1 DB riêng)

| # | Service | DB | Nhiệm vụ | Vai trò |
|---|---|---|---|---|
| 1 | Registry Service | MongoDB | Đăng ký target cần bảo vệ/giám sát, cấu hình ngưỡng | Nền tảng |
| 2 | **Traffic Shaping Gateway** | Redis | Kiểm soát admission, cấp vé xếp hàng, quản lý vị trí hàng đợi | ★ Core khác biệt |
| 3 | Probe Engine | TimescaleDB | Đo latency/error rate của backend định kỳ, tăng tần suất trong khung giờ đăng ký | Giám sát |
| 4 | **Capacity Advisor** | PostgreSQL | Phân tích xu hướng tải, ra lệnh điều chỉnh tốc độ admission cho Gateway | ★ Bộ não điều tiết |
| 5 | Alert Service | MongoDB | Gửi cảnh báo phân cấp (theo dõi / khẩn cấp) qua Telegram | Vận hành |
| 6 | Dashboard | — | Admin panel + Public status page (độ dài hàng đợi, ETA, xu hướng) | Giao diện |

**Bổ sung quan trọng — Mock Backend để demo:** Vì không thể test trực tiếp lên hệ thống thật của trường, nhóm cần tự xây 1 **backend đăng ký học phần giả lập** (CRUD đơn giản, cố tình dễ sập khi tải cao — không dùng connection pooling, không cache) làm "vật hy sinh" cho demo. Đây chính là cách tạo ra màn demo A/B thuyết phục nhất:
- **Kịch bản A:** Bắn 10.000 request thẳng vào Mock Backend (không qua Gateway) → sập/lag nặng, thấy rõ trên số liệu.
- **Kịch bản B:** Bắn cùng lượng tải qua Traffic Shaping Gateway → Mock Backend vẫn sống, sinh viên (giả lập) thấy hàng đợi + ETA thay vì lỗi trắng trang.

Đây là "money shot" của buổi bảo vệ — chứng minh trực quan giá trị hệ thống trong vài phút.

---

## 3. Tech stack đề xuất

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| Frontend (Dashboard + Public Status Page) | React hoặc HTML/CSS/JS + Chart.js | Ưu tiên đơn giản, dễ demo real-time |
| Registry Service | Node.js/Express + MongoDB | |
| Traffic Shaping Gateway | Node.js/Express + Redis (Sorted Set làm hàng đợi, TTL cho token) | Kỹ thuật: dùng Redis ZADD/ZRANK để quản lý vị trí xếp hàng công bằng |
| Probe Engine | Node.js (node-cron) + TimescaleDB | Adaptive interval: check dày hơn trong khung giờ đăng ký khai báo trước |
| Capacity Advisor | Python (dễ tính toán thống kê) hoặc Node.js + PostgreSQL | Thuật toán: moving average + độ dốc (slope) của latency/error rate để dự đoán xu hướng — không cần ML nặng |
| Alert Service | Node.js + MongoDB + Telegram Bot API | |
| Mock Backend (target giả lập) | Express đơn giản, cố tình không tối ưu | Dùng để demo A/B |
| Reverse Proxy | Nginx (đặt trước Gateway) | |
| IaC | Terraform (EC2, SG, VPC) | |
| CI/CD | GitHub Actions | Build & deploy Docker image |
| Load Test | k6 hoặc JMeter | Dùng để tự benchmark VÀ để demo trực tiếp trước hội đồng |
| Compute | EC2 t3.micro/t3.small (Free Tier) | |
| Containerization | Docker + Docker Compose | |

---

## 4. Roadmap 14 tuần (2 người: A thiên backend/data, B thiên hạ tầng/DevOps)

### Giai đoạn 0 — Chuẩn bị (Tuần 1)
- Viết đề cương, gửi thầy duyệt (đã có bằng chứng báo chí + hướng giải pháp rõ ràng)
- Setup repo, AWS account, Terraform skeleton
- Thiết kế ERD cho từng DB + vẽ lại kiến trúc chi tiết hơn nếu thầy góp ý

### Giai đoạn 1 — Hạ tầng + Mock Backend (Tuần 2-3)
- Terraform: VPC, EC2, Security Group
- Xây **Mock Backend** (registration API giả lập, cố tình fragile) — cần làm sớm vì mọi thứ sau đều test dựa trên nó
- Setup CI/CD cơ bản
- **Deliverable:** Mock Backend chạy trên EC2, JMeter bắn thẳng vào để có baseline "trước khi có EduPulse"

### Giai đoạn 2 — Core Monitoring (Tuần 4-6)
- Tuần 4: Registry Service
- Tuần 5: Probe Engine + Metrics DB (TimescaleDB)
- Tuần 6: Dashboard cơ bản hiển thị metrics
- **Deliverable:** Giám sát được Mock Backend, thấy dữ liệu real-time trên dashboard (tương đương milestone CloudWatch Campus cũ)

### Giai đoạn 3 — Traffic Shaping Gateway (Tuần 7-9) ★ Trọng tâm
- Tuần 7: Xây Gateway cơ bản — nhận request, kiểm tra admission rate, forward hoặc queue
- Tuần 8: Cơ chế hàng đợi Redis (ticket, vị trí, ETA), polling API cho client biết vị trí
- Tuần 9: Test Gateway độc lập — đảm bảo forward đúng, không rớt request, không deadlock hàng đợi
- **Deliverable (mốc quan trọng nhất):** Demo được Kịch bản B — bắn tải qua Gateway, Mock Backend không sập, sinh viên giả lập thấy hàng đợi

### Giai đoạn 4 — Capacity Advisor + Alert (Tuần 10-11)
- Tuần 10: Capacity Advisor — tính moving average + slope, quyết định "đang tiến gần ngưỡng quá tải"
- Tuần 11: Kết nối Advisor → Gateway (API điều chỉnh tốc độ admission), Alert Service phân cấp cảnh báo
- **Deliverable:** Vòng lặp tự động hoàn chỉnh — tải tăng → Advisor phát hiện → tự giảm tốc độ admission → cảnh báo admin

### Giai đoạn 5 — Bảo mật + Kiểm thử (Tuần 12)
- JWT/API key giữa các service
- Chống SSRF khi đăng ký target
- Load test toàn diện, ghi số liệu so sánh Kịch bản A vs B (đây là số liệu quan trọng nhất của báo cáo)
- Chaos test: tắt 1 service giữa chừng xem hệ thống phản ứng ra sao

### Giai đoạn 6 — Tài liệu & Chuẩn bị bảo vệ (Tuần 13)
- Hoàn thiện báo cáo, nhấn mạnh số liệu A/B benchmark
- Slide tập trung vào: vấn đề thật (trích báo chí) → giải pháp → demo trực quan → số liệu
- Quay video demo dự phòng cho cả 2 kịch bản (đề phòng lỗi mạng ngày bảo vệ)
- Luyện trả lời câu hỏi "khác biệt thật sự là gì" bằng chính script đã chuẩn bị

### Giai đoạn 7 — Buffer (Tuần 14)
- Không code mới, chỉ fix lỗi và luyện phản biện
- Kiểm tra lại toàn bộ hệ thống + Mock Backend còn chạy ổn định

---

## 5. Checklist tối thiểu trước khi bước vào phản biện

- [ ] Deploy thật trên AWS, demo live được cả 2 kịch bản A/B
- [ ] Có số liệu benchmark thật: % giảm lỗi/downtime khi có Gateway so với không có
- [ ] Capacity Advisor hoạt động tự động (không cần người bấm nút điều chỉnh thủ công)
- [ ] Có trích dẫn báo chí thật về vấn đề (đã có sẵn — VnExpress, Thanh Niên...)
- [ ] Trả lời trôi chảy câu hỏi "khác biệt so với chỉ giám sát là gì" bằng script đã chuẩn bị
- [ ] Có video demo dự phòng nếu live demo lỗi mạng
- [ ] Biết rõ giới hạn: chưa test trên hệ thống thật của trường, chỉ test trên Mock Backend tự xây — nói thẳng điều này nếu bị hỏi, đừng né tránh
