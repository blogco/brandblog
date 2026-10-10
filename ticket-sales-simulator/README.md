# Ticket Sales Simulator — Amadeus Terminal

Game mô phỏng **nghiệp vụ bán vé máy bay** chạy hoàn toàn trong một file `index.html`.
Không phụ thuộc mạng, không cần cài đặt, không bước build.

Bạn đóng vai nhân viên quầy vé của hãng hư cấu **TNHH Hưng Hà Airways (HH)** tại Hà Nội.
Thay vì bấm nút, bạn **gõ lệnh như trên hệ thống đặt chỗ Amadeus** (màn hình xanh đen,
chữ monospace, hiệu ứng CRT) để phục vụ từng khách: tra cứu chuyến, bán chỗ, tạo PNR,
tính giá rồi xuất vé — và giữ doanh thu, điểm uy tín.

> Sản phẩm học tập, phi thương mại. Hãng hàng không, số hiệu chuyến, giá vé và nhân vật
> đều hư cấu và đã được đơn giản hoá cho mục đích giảng dạy. Không liên kết với, cũng không
> được bảo trợ bởi, bất kỳ hãng hàng không hay hệ thống GDS nào.

## Cách chạy

1. Mở `index.html` bằng trình duyệt bất kỳ (**bấm đúp vào file**).
2. Tuỳ chọn local server (không bắt buộc):

   ```bash
   cd ticket-sales-simulator
   python3 -m http.server 8080
   # → http://localhost:8080
   ```

Toàn bộ HTML, CSS, JavaScript nằm trong một file `index.html` duy nhất.

## Cách chơi

Khách hàng xuất hiện với một yêu cầu. Bạn phục vụ theo đúng quy trình nghiệp vụ, gõ lệnh
vào dấu nhắc `>`:

| Lệnh | Ý nghĩa | Ví dụ |
|------|---------|-------|
| `AN<DDMMM><ORG><DST>` | Hiển thị chuyến bay & tình trạng chỗ | `AN10NOVHANSGN` |
| `SS<QTY><CLASS><LINE>` | Bán (giữ) chỗ theo dòng đã hiển thị | `SS3M1` |
| `NM1<SURNAME>/<GIVEN>` | Nhập tên hành khách (HỌ/TÊN, viết hoa, không dấu) | `NM1NGUYEN/VAN MINH` |
| `AP <PHONE>` | Thêm liên hệ | `AP 0912345678` |
| `SR <CODE>` | Yêu cầu dịch vụ đặc biệt (SSR) | `SR CHML` |
| `FXP` | Tính giá vé, thuế và phí | `FXP` |
| `TKTL` | Phát hành vé điện tử | `TKTL` |
| `RT` | Xem lại PNR | `RT` |
| `XE<LINE>` | Xoá một chặng | `XE1` |
| `IG` | Bỏ PNR hiện tại (ignore) | `IG` |
| `RF` | Hoàn vé gần nhất (refund) | `RF` |
| `HELP` | In danh sách lệnh | `HELP` |
| `CLS` | Xoá màn hình | `CLS` |

**Quy trình một hồ sơ:** `AN` → `SS` → `NM` (cho từng khách) → `AP` → `SR` (nếu cần) →
`FXP` → `TKTL`.

- Sau mỗi lệnh, một dòng **gợi ý theo ngữ cảnh** in ra bước tiếp theo (giống dòng gợi ý
  dưới cùng màn hình Amadeus), và **bảng lệnh** ở cột phải (bấm để chèn câu mẫu).
- Hạng đặt chỗ: **J / C** = Business, **Y** = Full Flex, **M / B** = Standard (23 kg hành lý),
  **K** = Light (không hành lý ký gửi). Bán đúng hạng theo nhu cầu của khách.
- Giá vé theo nhóm tuổi: người lớn 100%, trẻ em 2–11 tuổi 75%, em bé dưới 2 tuổi 10% (không ghế).
  Cộng thêm VAT 8%, phí sân bay, phí an ninh và phí xuất vé.
- **Hạn xuất vé (TTL):** sau khi giữ chỗ, bạn có 30 phút game để xuất vé. Mỗi lệnh trôi 2 phút.
  Hết hạn, chỗ tự động bị nhả và giá có thể đã đổi — đúng như thực tế.

### Điểm số & độ khó

- **Doanh thu** tích luỹ theo từng vé đã xuất; **điểm uy tín** (0–100) lên/xuống theo chất
  lượng phục vụ: bán đúng nhu cầu thì tăng, bán sai (thiếu hành lý, không đổi ngày được,
  chuyến tới muộn hơn giờ khách cần) thì bị khiếu nại và trừ điểm.
- Cứ **5 khách** là một **ca làm việc**: in báo cáo ca rồi tăng độ khó (nhiều khách hơn,
  phát sinh khứ hồi, trẻ nhỏ, em bé, yêu cầu dịch vụ đặc biệt).
- Uy tín về **0** là kết thúc ca. Chơi lại bằng cách gõ `CLS` rồi tải lại trang.

## Mục tiêu học tập

Sau khi chơi, bạn nên tự tin hơn với:

- **Đọc bảng tình trạng chỗ** — hiểu `M9`, `K0`, biết giá "từ X" phụ thuộc hạng đặt chỗ còn mở.
- **Tạo PNR đúng chuẩn** — định dạng tên `HỌ/TÊN`, thêm liên hệ, ghi dịch vụ qua SSR.
- **Chọn đúng loại giá** — so sánh theo tổng chi phí cho nhu cầu thật (hành lý, đổi ngày).
- **Tính đúng giá, thuế, phí** — phân biệt giá vé với VAT, phí sân bay/an ninh, phí xuất vé.
- **Quản lý hạn xuất vé** — vì sao chỗ bị nhả và giá thay đổi sau khi hết hạn.
- **Chăm sóc sau bán** — điều kiện hoàn vé theo hạng.

## Ghi chú kỹ thuật

- File đơn, thuần JavaScript, không thư viện ngoài, không CDN, không gọi API, không build.
- Giao diện tái tạo màn hình Amadeus: nền xanh đen, chữ monospace, hiệu ứng CRT
  (scanlines, vignette, nhấp nháy nhẹ), màu vàng/cyan/magenta cho dữ liệu.
- Responsive tới máy tính bảng và điện thoại; có lịch sử lệnh bằng phím ↑/↓.
- Cú pháp lệnh được đơn giản hoá so với Amadeus thật để phù hợp việc học.
