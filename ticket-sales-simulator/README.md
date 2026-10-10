# Ticket Sales Simulator — Amadeus Terminal

Game mô phỏng **nghiệp vụ bán vé máy bay** chạy hoàn toàn trong một file `index.html`.
Không phụ thuộc mạng, không cần cài đặt, không bước build.

Bạn đóng vai nhân viên quầy vé của hãng hư cấu **TNHH Hưng Hà Airways (HH)** tại Hà Nội.
Thay vì bấm nút, bạn **gõ lệnh như trên hệ thống đặt chỗ Amadeus** (màn hình xanh đen,
chữ monospace, hiệu ứng CRT) để phục vụ từng khách: nhập tên + APIS, tra cứu chuyến, bán chỗ,
tạo PNR, tính giá, xuất vé, tra lại vé bằng `RT#<PNR>` — và giữ doanh thu, điểm uy tín.

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
| `NM1<MR|MS> <SURNAME>/<GIVEN>` | Nhập tên hành khách **kèm danh xưng** (HỌ/TÊN, viết hoa, không dấu) | `NM1MR NGUYEN/VAN MINH` |
| `APIS <TYPE>/<ISSUE>/<DOCNO>/<NAT>/<DOB>/<SEX>/<EXP>/<SURNAME>/<GIVEN>` | Nhập dữ liệu hành khách theo **chuẩn IATA** (bắt buộc cho mọi khách) | `APIS P/VN/B1234567/VN/12MAR1985/M/15MAR2030/NGUYEN/VAN MINH` |
| `AN<DDMMM><ORG><DST>` | Hiển thị chuyến bay & tình trạng chỗ (chỉ sau khi đủ tên + APIS) | `AN10NOVHANSGN` |
| `SS<QTY><CLASS><LINE>` | Bán (giữ) chỗ theo dòng đã hiển thị | `SS3M1` |
| `AP <PHONE>` | Thêm liên hệ | `AP 0912345678` |
| `SR <CODE>` | Yêu cầu dịch vụ đặc biệt (SSR) | `SR CHML` |
| `FXP` | Tính giá vé, thuế và phí | `FXP` |
| `TKTL` | Phát hành vé điện tử | `TKTL` |
| `RT` | Xem lại PNR đang mở (hoặc vé gần nhất) | `RT` |
| `RT#<PNR>` | Tra **ruột vé đã xuất** + chi tiết + **thống kê doanh thu** | `RT#YF4AJ6` |
| `NEXT` | **Tiếp nhận khách mua vé kế tiếp** | `NEXT` |
| `XE<LINE>` | Xoá một chặng | `XE1` |
| `IG` | Bỏ PNR hiện tại (ignore) | `IG` |
| `RF` | Hoàn vé gần nhất (refund) | `RF` |
| `HELP` | In danh sách lệnh | `HELP` |
| `CLS` | Xoá màn hình | `CLS` |

**Quy trình một hồ sơ:** `NM` → `APIS` (cho **từng** khách) → `AN` → `SS` → `AP` →
`SR` (nếu cần) → `FXP` → `TKTL` → `RT#<PNR>` (tuỳ chọn) → `NEXT`.

### Nhập hành khách & APIS (bắt buộc trước khi tra cứu)

Trước khi được phép tra cứu chuyến (`AN`), bạn phải hoàn tất dữ liệu hành khách:

1. **Tên + danh xưng.** Danh xưng theo giới tính: **MR / MSTR** (Nam), **MRS / MS / MISS** (Nữ).
   Thiếu danh xưng, hoặc dùng sai giới tính, sẽ bị báo lỗi.
   Ví dụ: `NM1MR NGUYEN/VAN MINH`, `NM1MS TRAN/THU HA`.
2. **APIS (chuẩn IATA).** Mỗi hành khách nhập một dòng theo đúng thứ tự trường của IATA DOCS:

   ```
   APIS <TYPE>/<ISSUE>/<DOCNO>/<NAT>/<DOB>/<SEX>/<EXP>/<SURNAME>/<GIVEN>
   ```

   - `TYPE` — loại giấy tờ: `P` (hộ chiếu), `I` (CMND/CCCD)
   - `ISSUE` — nơi cấp (2 ký tự, vd `VN`)
   - `DOCNO` — số giấy tờ
   - `NAT` — quốc tịch (2 ký tự)
   - `DOB` / `EXP` — ngày sinh / ngày hết hạn, định dạng `DDMMMYYYY` (vd `12MAR1985`)
   - `SEX` — `M` / `F`
   - `SURNAME` / `GIVEN` — họ và tên (khớp tên đã nhập ở bước 1)

   Mọi dữ liệu cần thiết đã in sẵn trong khối yêu cầu của khách — bạn chỉ cần **ghép đúng
   thứ tự**. Sai một trường, hệ thống chỉ ra trường sai và giá trị đúng để bạn sửa.

> Nhập đủ tên + APIS cho **toàn bộ** hành khách thì `AN` mới chạy. Các chuyến bay gồm cả
> tuyến nội địa và quốc tế (SIN, BKK, ICN, KUL, NRT).

### Sau khi xuất vé

Xuất vé xong hệ thống **không tự chuyển khách**. Bạn có hai lựa chọn:

- `RT#<PNR>` — in lại **ruột vé** (hành khách, hành trình, giá/thuế/phí) kèm **thống kê
  doanh thu** (doanh thu ca, số vé, số chặng, khách đã phục vụ, điểm uy tín).
- `NEXT` — nhả quầy, **tiếp nhận khách mua vé kế tiếp**.

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
- **Tạo hồ sơ hành khách đúng chuẩn** — danh xưng (MR/MRS/MS/MISS/MSTR), định dạng tên
  `HỌ/TÊN`, nhập **APIS theo chuẩn IATA**, thêm liên hệ, ghi dịch vụ qua SSR.
- **Tra cứu sau bán** — dùng `RT#<PNR>` để kiểm tra ruột vé và đọc thống kê doanh thu.
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
