# CORE BANKING SIMULATOR - Ngân hàng Lõi

Game terminal tiếng Việt: người chơi trực ca vận hành core banking cho ngân
hàng hư cấu **Ngân hàng TMCP Á Châu Việt (ACBV)**. Toàn bộ dữ liệu là giả lập;
game không kết nối ngân hàng, NAPAS, SWIFT hoặc NHNN và không thay thế hướng
dẫn/phần mềm nghiệp vụ chính thức.

## Chạy game

Yêu cầu Python 3.10 trở lên; không cần cài package ngoài.

### Chơi trực tiếp trên web

Mở bản web tại <https://blogco.github.io/brandblog/core-banking-simulator/>.
Bản web là giao diện trình duyệt tĩnh; lệnh được mô phỏng phía client và game
tự lưu trong `localStorage` của trình duyệt đó. Nó không chạy Python hay kết nối
hệ thống ngân hàng thật. Lệnh `save` / `load` của bản web dùng bộ nhớ trình
duyệt, độc lập với file JSON của phiên bản CLI.

Có thể chạy web local qua HTTP (không mở `index.html` trực tiếp bằng `file://`):

```bash
cd core-banking-simulator
python3 -m http.server 8000
# mở http://localhost:8000/
```

### Chạy bản Python CLI

```bash
cd core-banking-simulator
python3 main.py
```

Mỗi ca mặc định kéo dài 5 phút thực tế, có thể chỉnh bằng `--day-minutes`:

```bash
python3 main.py --day-minutes 10
python3 main.py --no-color
python3 main.py --load savegame.json
```

Các lệnh hoạt động khi game đang chờ nhập liệu; giao dịch mới và sự cố được
sinh theo thời gian, SLA tiếp tục chạy trong nền. Dùng `save` trước `quit` để
lưu game vào `savegame.json`; `save <file>` chọn tên khác. Tải bằng
`python3 main.py --load [file]`.

## Cách chơi nhanh

1. Gõ `status` để xem giao dịch, SLA, sự cố và KPI; `list-accounts` để xem tài khoản.
2. Xử lý giao dịch mẫu bằng `process TX0001`. Mỗi giao dịch đúng được +10 điểm.
3. Dùng `resolve INC0001 <action>`; action bắt buộc được nêu trong `status`.
   Xử lý sự cố đúng được +5 điểm; action sai bị trừ 5 điểm.
4. Thử lệnh nghiệp vụ như `deposit 123456789 1.000.000`,
   `transfer 123456789 123456790 500000`, `freeze 123456789`.
5. Cuối ca chạy `eod-batch`, `reconcile`, `report-sbv`, sau đó `next-day`.
   Lệnh `next-day` tự chạy EOD rồi mở ca mới.
6. Gõ `help` để xem danh sách đầy đủ. Tiền nhập là số nguyên VND; dấu chấm
   phân tách hàng nghìn là tùy chọn.

Level tăng theo điểm/ngày: Teller cơ bản → Back-office → Treasury → Credit →
Crisis → Audit & Compliance. NAPAS mở ở cấp 2, SWIFT ở cấp 3, tín dụng ở cấp 4.

## Danh sách lệnh

| Lệnh | Tác dụng |
|---|---|
| `help` | In hướng dẫn lệnh |
| `status` | Trạng thái hệ thống, hàng đợi, KPI và sự cố |
| `list-accounts` | Danh sách tài khoản, số dư, trạng thái |
| `open-account <cif> <CASA\|TIETKIEM\|LOAN>` | Mở tài khoản thanh toán/tiết kiệm/vay |
| `deposit <acc> <amount>` | Nộp tiền |
| `withdraw <acc> <amount>` | Rút tiền |
| `transfer <from> <to> <amount>` | Chuyển khoản nội bộ |
| `napas <from> <bank> <acc> <amount>` | Chuyển liên ngân hàng (cấp 2+) |
| `swift <from> <bic> <amount> <currency>` | Chuyển quốc tế (cấp 3+) |
| `process <txn_id>` | Xử lý một giao dịch trong hàng đợi |
| `resolve <incident_id> <action>` | Xử lý sự cố; dùng đúng action được yêu cầu |
| `loan-disburse <loan_id> <amount>` | Giải ngân khoản vay (cấp 4+) |
| `loan-repay <loan_id> <amount>` | Thu nợ khoản vay (cấp 4+) |
| `classify-loan <loan_id> <1-5>` | Phân loại nhóm nợ (cấp 4+) |
| `interest-calc <acc>` | Ước tính lãi; không tự hạch toán |
| `fee-calc <txn_id>` | Tra phí tham chiếu; không tự hạch toán |
| `eod-batch` | Kết chuyển lãi mô phỏng, phát hiện giao dịch tồn |
| `reconcile` | Đối chiếu giao dịch đang chờ |
| `report-sbv` | Xuất báo cáo vận hành giả lập (cấp 2+) |
| `audit <txn_id>` | Xem dấu vết giao dịch |
| `freeze <acc>` / `unfreeze <acc>` | Phong tỏa / giải tỏa tài khoản |
| `save [file]` | Lưu trạng thái JSON |
| `next-day` | Chạy EOD và chuyển sang ngày làm việc tiếp theo |
| `quit` | Thoát game |

## Dữ liệu và mở rộng

- `index.html`, `web-game.mjs`, `web-style.css`: phiên bản web tĩnh, chạy trong trình duyệt.
- `main.py`: vòng lặp Python CLI, phân tích lệnh và đồng hồ ca trực.
- `core_banking.py`: nghiệp vụ giao dịch, tín dụng, đối chiếu, lưu/tải.
- `models.py`: mô hình và chuyển đổi JSON cho trạng thái.
- `events.py`: sinh giao dịch/sự cố và kiểm tra SLA.
- `ui.py`: giao diện khung ANSI 80+ cột.
- `data.json`: 10 khách hàng, 12 tài khoản, 2 khoản vay và 20 giao dịch mẫu.

Các mức lãi suất, phí, hạn mức và quy trình chỉ phục vụ gameplay. Phân loại
nợ 1–5 tham chiếu tên nhóm theo Thông tư 11/2021/TT-NHNN; đây không phải triển
khai đầy đủ quy định pháp luật. Các giao dịch mẫu có thể dùng CCCD 12 số; dữ
liệu demo không chứa thông tin cá nhân thật.

`open-account ... LOAN` tạo tài khoản chờ liên kết với khoản vay đã được phê
duyệt; giải ngân/thu nợ thao tác qua `loan-disburse` và `loan-repay` với khoản
vay giả lập `LN0001`/`LN0002` trong dữ liệu mẫu.
