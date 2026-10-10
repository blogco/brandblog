Title: Pastenote
Slug: pastenote
URL: pastenote/
Save_as: pastenote/index.html
Template: pastenote
Status: published
Summary: Dán mọi thứ khẩn cấp — link, ảnh, text — dưới dạng giấy note 3M Post-it. Tự động lưu trên máy và có thể đồng bộ lên GitHub.

The Pastenote page is rendered by the custom `pastenote` template. It is a public
3M Post-it style board: paste a link, an image or plain text and it becomes a
sticky note. Every change is auto-saved to `localStorage` (key `pastenote_notes`);
an admin can commit the merged set to `content/data/pastenote.json` with a GitHub
Personal Access Token typed in the browser (never committed to this repository).
