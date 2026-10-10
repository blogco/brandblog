# Ticket Sales Simulator

Game mô phỏng **nghiệp vụ bán vé máy bay cho khách hàng cá nhân** — chạy hoàn toàn
trong một file `index.html`, không phụ thuộc mạng, không cần cài đặt.

Bạn đóng vai nhân viên quầy vé của hãng **Hưng Hà Airways (HH)** tại Hà Nội, phục vụ
một hồ sơ khách lẻ: gia đình chị **Nguyễn Thị Lan** (2 người lớn + 1 bé 6 tuổi) đặt vé
khứ hồi **Hà Nội (HAN) → TP. Hồ Chí Minh (SGN)**, đi 15NOV và về 18NOV. Mỗi giai đoạn
đưa ra một quyết định nghiệp vụ, sau đó giải thích *vì sao* đáp án như vậy.

> Sản phẩm học tập, phi thương mại. Hãng hàng không, số hiệu chuyến bay, giá vé, thuế
> phí và nhân vật trong game đều hư cấu và được đơn giản hoá cho mục đích giảng dạy.
> Không liên kết với, và không được bảo trợ bởi, bất kỳ hãng hàng không hay đại lý nào.

## Cách chạy

Không cần build, không dependency, không gọi mạng.

1. Mở `index.html` bằng trình duyệt bất kỳ — **bấm đúp vào file**, hoặc kéo vào cửa sổ
   trình duyệt.
2. Tuỳ chọn local server (không bắt buộc):

   ```bash
   cd ticket-sales-simulator
   python3 -m http.server 8080
   # → http://localhost:8080
   ```

Toàn bộ (HTML, CSS, JavaScript, icon) nằm trong một file `index.html` duy nhất.

## Cách chơi

- Lần lượt vượt qua **8 giai đoạn** bằng nút **Giai đoạn tiếp theo →**. Nút bị khoá
  cho tới khi làm xong mọi việc của giai đoạn, và dòng gợi ý bên cạnh luôn liệt kê rõ
  còn thiếu việc gì (ví dụ *"Còn phải làm: tự tính tổng tiền vé, các khoản thuế, phí
  cộng thêm"*).
- Một số giai đoạn mở đầu bằng **bài tập tương tác**: nhập số tiền vé vào máy tính
  (Giai đoạn 4) hoặc chọn 3 ghế liền nhau trên sơ đồ khoang (Giai đoạn 5). Bài tập được
  chấm điểm thưởng (+5 điểm).
- Mỗi giai đoạn có ít nhất một điểm quyết định. Chọn đáp án rồi bấm **Kiểm tra đáp án**
  để nhận phản hồi tức thì kèm giải thích nghiệp vụ.
- Đúng **ngay lần đầu** được trọn điểm; làm lại đúng được nửa số điểm. Sau 3 lần sai,
  đáp án đúng được tô sáng để bạn không bao giờ bị kẹt. Câu chọn nhiều đáp án tự bỏ
  tick khi sai để làm lại sạch sẽ.
- Bạn có thể **quay lại** bất kỳ lúc nào bằng **← Giai đoạn trước** — các câu đã làm
  vẫn giữ nguyên, điểm không bị trừ.
- Màn hình kết quả hiển thị điểm, xếp hạng và bảng điểm theo từng giai đoạn, kèm nút
  **Ôn lại từ giai đoạn 1**.

## Bản đồ giai đoạn

| # | Giai đoạn | Bạn quyết định |
|---|-----------|----------------|
| 1 | Tiếp nhận & tra cứu chuyến bay | Chuyến bay + hạng đặt chỗ phù hợp từ bảng tình trạng chỗ; giải thích cho khách vì sao giá báo cao hơn giá quảng cáo |
| 2 | Tạo PNR | Định dạng tên hành khách đúng chuẩn; thông tin bắt buộc cho bé 6 tuổi bay nội địa |
| 3 | Chọn loại giá & điều kiện vé | Light / Standard / Flex cho nhu cầu hành lý + đổi ngày; điều kiện hoàn vé của hạng Standard |
| 4 | Tính giá & thuế, phí | Giá trẻ em 75%; **tự tính tổng tiền vé** (bonus); các khoản thuế, phí cộng thêm |
| 5 | Ghế ngồi & dịch vụ đặc biệt | **Chọn 3 ghế liền nhau** trên sơ đồ (bonus); đặt suất ăn trẻ em qua SSR; quy định hàng cửa thoát hiểm |
| 6 | Hạn xuất vé & xuất vé điện tử | Xử lý khi hết hạn xuất vé (TTL); danh sách kiểm tra trước khi xuất vé |
| 7 | Thanh toán & hoá đơn | Thanh toán bằng thẻ của người khác; xuất hoá đơn GTGT cho doanh nghiệp |
| 8 | Sau bán: đổi, hoàn vé | Quyền của khách khi hãng đổi giờ bay (involuntary); đổi ngày tự nguyện theo điều kiện giá |

## Mục tiêu học tập

Sau khi chơi xong, bạn nên tự tin:

- **Tra cứu và bán đúng chỗ** — đọc bảng tình trạng chỗ theo hạng đặt chỗ (Y/M/B/K),
  chọn chuyến vừa đủ nhu cầu của khách, và giải thích được vì sao giá "từ X" không phải
  lúc nào cũng mua được.
- **Tạo PNR đúng chuẩn** — nhập tên theo họ trước/tên sau, bắt buộc có ngày sinh, ghi đủ
  thông tin liên hệ; hiểu vì sao vé đã xuất gần như không sửa được.
- **Tư vấn loại giá** — so sánh Light/Standard/Flex theo *tổng chi phí cho nhu cầu thật*
  (hành lý, đổi ngày, hoàn vé), không theo con số nhỏ nhất trên bảng giá.
- **Tính đúng giá, thuế, phí** — phân biệt giá vé với thuế, phí; áp đúng nhóm tuổi
  (người lớn 100%, trẻ em 2–11 tuổi 75%, em bé dưới 2 tuổi 10%) và báo giá thành hai
  phần rõ ràng.
- **Xử lý ghế & dịch vụ đặc biệt** — chọn chỗ theo quy hoạch ghế; đặt yêu cầu dịch vụ
  qua SSR thay vì OSI; biết quy định an toàn của hàng cửa thoát hiểm.
- **Quản lý hạn xuất vé** — giải thích TTL, xử lý khi chỗ bị nhả, và kiểm tra toàn bộ
  PNR trước khi phát hành vé điện tử.
- **Kiểm soát thanh toán** — quy trình thanh toán bên thứ ba (uỷ quyền của chủ thẻ),
  bảo mật dữ liệu thẻ, và quy tắc xuất hoá đơn GTGT.
- **Chăm sóc sau bán** — phân biệt thay đổi do hãng (involuntary) với thay đổi tự nguyện
  của khách (voluntary), thu đúng phí và xử lý đúng quyền lợi của khách.

## Điểm số

- Mỗi câu hỏi: **10 điểm** (câu kết Giai đoạn 8: **15 điểm**) — đúng lần đầu trọn điểm,
  làm lại đúng nửa điểm, sau 3 lần sai đáp án được hé lộ.
- Bài tập tương tác (máy tính tiền vé, chọn ghế): **+5 điểm** mỗi bài, không giới hạn số
  lần thử.
- **Tối đa 180 điểm** cho cả 8 giai đoạn.

## Ghi chú kỹ thuật

- File đơn, thuần JavaScript, không thư viện ngoài, không CDN, không gọi API, không bước
  build.
- Responsive tới màn hình máy tính bảng và điện thoại.
- Tiến trình và điểm số lưu trong một object trạng thái nhỏ trong bộ nhớ
  (`{ phase, answers, finished }`).
- Giao diện tiếng Việt, thuật ngữ tiếng Anh (PNR, TTL, SSR, FOP, E-ticket…) hiển thị
  dưới dạng chú thích khi di chuột — vừa chơi vừa ghi nhớ thuật ngữ quốc tế dùng trong
  phòng vé.
- Màu sắc và font theo design system của BrandBlog (xanh #006C53, nền mist, font
  Frutiger/Helvetica).
- Hỗ trợ bàn phím: focus ring, `aria-pressed` trên đáp án, vùng thông báo live, link bỏ
  qua và thanh tiến trình thân thiện với trình đọc màn hình.