# Product Vision & Aim

## Aim chốt của project

```text
A secure, evidence-backed Requirement-to-Code Impact Analyzer.
```

### Bản Việt

Một hệ thống phân tích impact có bằng chứng, giúp nối requirement change với code backend bị ảnh hưởng, chỉ ra unknown/risk/QA scenario, và tạo traceability report sau khi human review.

### Nói ngắn

```text
Requirement change
→ scan backend repo an toàn
→ tìm impacted APIs/services/entities/tests
→ lấy code evidence
→ sinh insights/unknowns/QA scenarios
→ BA/QA review
→ finalize Markdown impact report
```

### Không phải

```text
AI coding agent
repo chatbot
generic documentation generator
tool tự hiểu toàn bộ repo 100%
```

### Giá trị chính

```text
giảm missed impact
giảm hỏi qua lại giữa BA/QA/dev
giúp estimate/test planning tốt hơn
tạo traceability từ requirement → code → evidence → report
giảm token/cost bằng cách gửi evidence pack nhỏ thay vì cả repo
```

### Invariant phải giữ

```text
Evidence trước, AI sau.
Không có evidence thì UNKNOWN, không bịa.
Repo là untrusted input, không execute code.
Retrieval phải observable.
Human review trước finalize.
Report cuối do backend generate, FE không tự dựng lại.
```

### Positioning tốt nhất

```text
Before implementing a requirement change, teams can see which backend APIs, services, entities, tests, and business rules may be affected — with code evidence, unknowns, QA scenarios, and a human-reviewed impact report.
```
