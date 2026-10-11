# Ticket Sales Simulator — Amadeus Terminal

Game mô phỏng **nghiệp vụ bán vé máy bay** chạy hoàn toàn trong một file `index.html`.
Không phụ thuộc mạng, không cần cài đặt, không bước build.

Bạn đóng vai nhân viên quầy vé của hãng hư cấu **TNHH Hưng Hà Airways (HH)** tại Hà Nội.
Thay vì bấm nút, bạn **gõ lệnh như trên hệ thống đặt chỗ Amadeus** (màn hình xanh đen,
chữ monospace, hiệu ứng CRT) để phục vụ từng khách: nhập tên + APIS, tra cứu chuyến, bán chỗ,
tạo PNR, tính giá, thu phí dịch vụ, xuất vé, tra lại vé bằng `RT#<PNR>` — và giữ doanh thu, điểm uy tín.
Các lệnh phụ trợ thực tế (sửa tên `NACO`, thông tin tàu bay `EQ`, thời tiết `WEA`, giải mã `DA`…)
cũng được mô phỏng theo chuẩn Amadeus.

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

### Gợi ý quy trình bán vé

Mở **[ BÁN VÉ ]** trên thanh công cụ để xem bảng lệnh được tạo từ hành khách và hành trình
đang hiển thị. Sau khi chạy `AN`, chọn dòng chuyến bay và hạng đặt chỗ trong bảng để hoàn
thiện lệnh `SS`; nhập email hoặc số điện thoại vào trường liên hệ. **Copy** sao chép từng
lệnh; **Copy All** sao chép nhóm lệnh sẵn sàng tiếp theo theo đúng thứ tự thực thi. Dán nhóm
lệnh vào ghi chú rồi chạy từng lệnh một trong terminal.

Bảng dùng đúng cú pháp mà simulator chấp nhận: nhập `NM` và APIS trước khi tra cứu; APIS có
thứ tự `<TYPE>/<ISSUE>/<DOCNO>/<NAT>/...`; lệnh bán chỗ có dạng `SS<QTY><CLASS><LINE>`.
PTC (ADT/CHD/INF) được hiển thị riêng, không nối vào tên. `TTP` là bí danh phát hành vé của
simulator. Thông tin liên hệ chỉ nằm trong trang hiện tại, không được gửi đi hay lưu lại.

## Cách chơi

Khách hàng xuất hiện với một yêu cầu. Bạn phục vụ theo đúng quy trình nghiệp vụ, gõ lệnh
vào dấu nhắc `>`:

| Lệnh | Ý nghĩa | Ví dụ |
|------|---------|-------|
| `NM1<MR|MS> <SURNAME>/<GIVEN>` | Nhập tên hành khách **kèm danh xưng** (HỌ/TÊN, viết hoa, không dấu) | `NM1MR NGUYEN/VAN MINH` |
| `NACO<LINE><TÊN MỚI>` | **Sửa tên hành khách** (name correction). Đổi ≤3 ký tự miễn phí; đổi nhiều hơn bị thu phí `NACO` | `NACO2MR TRAN/THU HA` |
| `APIS <TYPE>/<ISSUE>/<DOCNO>/<NAT>/<DOB>/<SEX>/<EXP>/<SURNAME>/<GIVEN>` | Nhập dữ liệu hành khách theo **chuẩn IATA** (bắt buộc cho mọi khách) | `APIS P/VN/B1234567/VN/12MAR1985/M/15MAR2030/NGUYEN/VAN MINH` |
| `AN<DDMMM><ORG><DST>` | Hiển thị chuyến bay & tình trạng chỗ (chỉ sau khi đủ tên + APIS) | `AN10NOVHANSGN` |
| `SS<QTY><CLASS><LINE>` | Bán (giữ) chỗ theo dòng đã hiển thị | `SS3M1` |
| `XK<LINE>` / `XE<LINE>` | Huỷ / xoá một chặng trong PNR | `XK1` |
| `SO <AMOUNT>` | **Thu phí dịch vụ** ngay trên màn hình (gộp vào tổng khi tính giá) | `SO150000` |
| `FO <FORM>` | Ghi **hình thức thanh toán** (`CASH` / `CK` / `CC<16 số>/<YYMM>`) | `FO CASH` |
| `AP <PHONE>` | Thêm liên hệ | `AP 0912345678` |
| `SR <CODE>` | Yêu cầu dịch vụ đặc biệt (SSR) | `SR CHML` |
| `FXP` | Tính giá vé, thuế, phí và dịch vụ | `FXP` |
| `TQT` | Xem **chi tiết thuế & phí** (chưa gồm giá vé) | `TQT` |
| `TKTL` / `TTP` | Phát hành vé điện tử | `TKTL` |
| `TTK` | **Danh sách số vé đã xuất** | `TTK` |
| `RT` | Xem lại PNR đang mở (hoặc vé gần nhất) | `RT` |
| `RD` | Hiển thị lại PNR (redisplay) | `RD` |
| `RT#<PNR>` | Tra **ruột vé đã xuất** + chi tiết + **thống kê doanh thu** | `RT#YF4AJ6` |
| `EQ<CODE>` | **Thông tin tàu bay** (equipment): tầm bay, sức chứa, động cơ… (`EQ` không mã = danh sách đội tàu) | `EQ320` |
| `WEA <CITY>` | **Thời tiết 5 ngày** tại điểm đến | `WEA SGN` |
| `DA <CITY>` | Giải mã mã sân bay (decode) | `DA SIN` |
| `NEXT` | **Tiếp nhận khách mua vé kế tiếp** | `NEXT` |
| `IG` | Bỏ PNR hiện tại (ignore) | `IG` |
| `RF` | Hoàn vé gần nhất (refund) | `RF` |
| `HELP` | In danh sách lệnh | `HELP` |
| `CLS` | Xoá màn hình | `CLS` |

**Quy trình một hồ sơ:** `NM` → `APIS` (cho **từng** khách) → `AN` → `SS` → `AP` →
`(NACO nếu sửa tên)` → `(SO nếu thu phí dịch vụ)` → `(FO nếu ghi thanh toán)` → `SR` (nếu cần) →
`FXP` → `TKTL` → `RT#<PNR>` (tuỳ chọn) → `NEXT`.

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

### Sửa tên hành khách (NACO) & thu phí dịch vụ

**Đổi tên — `NACO<LINE><TÊN MỚI>`** (Amadeus: name correction). `LINE` là số thứ tự hành
khách trong hồ sơ (1, 2, 3…):

```
NACO2MR TRAN/THU HA        ← hành khách số 2, đổi thành TRAN/THU HA (kèm danh xưng mới)
```

- Theo quy tắc **TIM/IATA**, tên đổi không quá **3 ký tự** (so với tên trước) được miễn phí,
  không phải xuất lại vé. Đổi nhiều hơn 3 ký tự bị **thu phí đổi tên `NACO` (225.000 VND)**,
  tự động gộp vào giá khi tính `FXP`.
- Sau đổi tên, **phải nhập lại APIS** cho hành khách đó (tên trong APIS phải khớp) trước khi
  tra cứu lại.
- Có thể gõ `NU…` thay cho `NACO…` (cách ghi tắt trong thực tế).

**Thu phí dịch vụ — `SO <AMOUNT>`** (service fee): thu phí dịch vụ ngay trên màn hình,
gộp vào tổng tiền khi tính giá và xuất vé:

```
SO150000                 ← phí dịch vụ 150.000 VND
FXP                      ← xem phí được liệt kê và cộng vào tổng
```

**Hình thức thanh toán — `FO <FORM>`**: ghi cách khách thanh toán (tiền mặt / séc / thẻ),
hiển thị trên PNR và trên ra ruột vé:

```
FO CASH                  ← tiền mặt
FO CK                    ← séc (cheque)
FO CC4111111111111111/0426   ← thẻ tín dụng
```

### Tra cứu thông tin

- **`EQ<CODE>`** — thông tin tàu bay (equipment): sức chứa, tầm bay, tốc độ, động cơ…
  `EQ` không kèm mã in danh sách đội tàu của Hưng Hà Airways.
- **`WEA <CITY>`** — thời tiết **5 ngày** tại điểm đến (mã sân bay), ví dụ `WEA SGN`.
- **`DA <CITY>`** — giải mã mã sân bay (decode), ví dụ `DA SIN`.
- **`TQT`** — chi tiết thuế & phí của hồ sơ (chưa gồm giá vé).
- **`TTK`** — danh sách số vé đã xuất trong ca.

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

### Tình huống bất khả kháng

Sau mỗi giao dịch hoàn tất (**TKTL** xuất vé / **RF** hoàn vé), có **35%** xác suất nổ ra
một **tình huống bất khả kháng** — system alert nền đỏ, chữ vàng, viền nhấp nháy, kèm tiếng
"beep". Khách hàng, chuyến bay, record locator trong cảnh báo được lấy từ hồ sơ thực tế của bạn.

Mỗi sự cố đưa ra **2–3 hướng xử lý** (gõ số `1/2/3` hoặc bấm nút trên màn hình). Mỗi hướng
tác động tới **3 chỉ số KPI** của ca:

- **DOANH THU** — cộng/trừ vào doanh thu ca (đơn vị nghìn VND);
- **UY TÍN** (0–100) — xử lý hợp tình hợp lý thì tăng, vụng về thì khiếu nại;
- **CĂNG THẲNG** (0–100, mới) — chỉ số áp lực quầy, hiển thị trên thanh HUD.

8 tình huống mô phỏng theo sự cố thật ở quầy vé: khách **nợ thuế bị cấm xuất cảnh**, **hủy vé
phút chót vì bệnh**, **đổi ý đòi hoàn tiền**, **lỗi hệ thống vé biến mất**, **trùng tên danh
sách cấm bay**, **chuyến bay quá tải (overbooked)**, **hộ chiếu hết hạn**, **sai tên trên vé**.
Khi sự cố đang chờ, bạn **phải xử lý xong mới được gõ lệnh khác** (kể cả `NEXT`).

### Điểm số & độ khó

- **Doanh thu** tích luỹ theo từng vé đã xuất (bị trừ khi hoàn vé, khiếu nại, bồi thường qua
  tình huống bất khả kháng); **điểm uy tín** (0–100) lên/xuống theo chất lượng phục vụ:
  bán đúng nhu cầu thì tăng, bán sai (thiếu hành lý, không đổi ngày được, chuyến tới muộn hơn
  giờ khách cần) thì bị khiếu nại và trừ điểm. **Chỉ số căng thẳng** tăng khi xử lý sự cố
  kém và hạ khi xử lý khéo.
- Cứ **5 khách** là một **ca làm việc**: in báo cáo ca rồi tăng độ khó (nhiều khách hơn,
  phát sinh khứ hồi, trẻ nhỏ, em bé, yêu cầu dịch vụ đặc biệt).
- Uy tín về **0** là kết thúc ca. Chơi lại bằng cách gõ `CLS` rồi tải lại trang.

## Mục tiêu học tập

Sau khi chơi, bạn nên tự tin hơn với:

- **Đọc bảng tình trạng chỗ** — hiểu `M9`, `K0`, biết giá "từ X" phụ thuộc hạng đặt chỗ còn mở.
- **Tạo hồ sơ hành khách đúng chuẩn** — danh xưng (MR/MRS/MS/MISS/MSTR), định dạng tên
  `HỌ/TÊN`, nhập **APIS theo chuẩn IATA**, thêm liên hệ, ghi dịch vụ qua SSR.
- **Sửa tên theo quy tắc TIM/IATA** — `NACO` (≤3 ký tự miễn phí, đổi nhiều hơn thu phí) và
  cập nhật APIS sau khi đổi tên.
- **Thu phí dịch vụ & thanh toán** — thu phí `SO` ngay trên màn hình, ghi hình thức thanh toán `FO`.
- **Tra cứu thông tin** — tàu bay (`EQ`), thời tiết điểm đến (`WEA`), giải mã sân bay (`DA`).
- **Tra cứu sau bán** — dùng `RT#<PNR>` để kiểm tra ruột vé và đọc thống kê doanh thu.
- **Chọn đúng loại giá** — so sánh theo tổng chi phí cho nhu cầu thật (hành lý, đổi ngày).
- **Tính đúng giá, thuế, phí** — phân biệt giá vé với VAT, phí sân bay/an ninh, phí xuất vé.
- **Quản lý hạn xuất vé** — vì sao chỗ bị nhả và giá thay đổi sau khi hết hạn.
- **Chăm sóc sau bán** — điều kiện hoàn vé theo hạng.

## Ghi chú kỹ thuật

- Ứng dụng nằm trong một file HTML, thuần JavaScript, không thư viện ngoài, CDN hay API bên ngoài.
- Giao diện tái tạo màn hình Amadeus: nền xanh đen, chữ monospace, hiệu ứng CRT
  (scanlines, vignette, nhấp nháy nhẹ), màu vàng/cyan/magenta cho dữ liệu.
- Responsive tới máy tính bảng và điện thoại; có lịch sử lệnh bằng phím ↑/↓.
- Cú pháp lệnh được đơn giản hoá so với Amadeus thật để phù hợp việc học.
