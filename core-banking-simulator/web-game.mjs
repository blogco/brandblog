const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = "acbv-core-banking-save-v1";
const BANKS = ["VCB", "TCB", "BIDV", "CTG", "ACB", "MB", "VPB"];
const LEVELS = ["Teller cơ bản", "Back-office", "Treasury", "Credit", "Crisis", "Audit & Compliance"];
const THRESHOLDS = [0, 50, 120, 220, 350, 500];
const RATES = { KHONGKYHAN: 0.001, "1M": 0.026, "6M": 0.045, "12M": 0.055 };
const INCIDENTS = [
  ["NAPAS timeout", "Phản hồi NAPAS quá hạn; cần tra soát giao dịch treo.", "investigate"],
  ["ATM hết tiền", "ATM chi nhánh Quận 1 cần điều tiền tiếp quỹ.", "dispatch"],
  ["Sai lệch số dư", "Phát hiện sai lệch sổ phụ và sổ cái.", "reconcile"],
  ["Khách hàng khiếu nại", "Yêu cầu tra soát từ Contact Center.", "respond"],
  ["Tấn công DDoS", "Độ trễ kênh ngân hàng số đang tăng.", "mitigate"],
  ["Rò rỉ dữ liệu", "Cảnh báo truy cập dữ liệu bất thường.", "report"],
  ["NHNN thanh tra", "Yêu cầu trích xuất báo cáo vận hành.", "report"],
  ["Khủng hoảng thanh khoản", "Dự báo dòng tiền cuối ngày xuống dưới ngưỡng.", "balance"],
  ["Lãi suất thay đổi", "Cập nhật biểu lãi suất tiền gửi.", "update"],
  ["Tỷ giá biến động", "Cập nhật tỷ giá USD/VND trong phiên.", "update"],
];

let state;
let startedAt = performance.now();
let lastEventAt = 0;
let lastIncidentAt = 0;
let rng = Math.random;

function createState(data, minutes) {
  const now = new Date().toISOString();
  return {
    bank_name: data.bank_name,
    business_date: localDateString(),
    day_number: 1,
    day_minutes: minutes,
    day_elapsed_seconds: 0,
    day_closed: false,
    score: 0,
    level: 1,
    system_status: "ONLINE",
    cash_reserve: data.cash_reserve,
    fx_usd_vnd: data.fx_usd_vnd,
    interest_rates: { ...RATES },
    customers: Object.fromEntries(data.customers.map((item) => [item.cif, item])),
    accounts: Object.fromEntries(data.accounts.map((item) => [item.number, { frozen: false, status: "ACTIVE", currency: "VND", ...item }])),
    loans: Object.fromEntries((data.loans ?? []).map((item) => [item.loan_id, item])),
    transactions: data.transactions.map((item) => ({ ...item, created_at: now, sla_penalized: false })),
    incidents: [],
    logs: [],
    processed_today: 0,
    ledger_mismatch: 0,
  };
}

function fmt(value) {
  return `${Math.round(value).toLocaleString("vi-VN")} VNĐ`;
}

function timeNow() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function log(message, type = "") {
  state.logs.push({ time: timeNow(), message, type });
  state.logs = state.logs.slice(-50);
}

function account(number, allowFrozen = false) {
  const item = state.accounts[number];
  if (!item) throw Error(`Không tìm thấy tài khoản ${number}.`);
  if (item.status !== "ACTIVE") throw Error(`Tài khoản ${number} không hoạt động.`);
  if (item.account_type === "LOAN") throw Error("Tài khoản vay không dùng cho giao dịch CASA.");
  if (item.frozen && !allowFrozen) throw Error(`Tài khoản ${number} đang bị phong tỏa.`);
  return item;
}

function amountArg(value) {
  const number = Number(String(value ?? "").replace(/[.,]/g, ""));
  if (!Number.isSafeInteger(number) || number <= 0) throw Error("Số tiền phải là số nguyên dương.");
  return number;
}

function requireLevel(level, name) {
  if (state.level < level) throw Error(`${name} mở từ cấp ${level} (${LEVELS[level - 1]}).`);
}

function transaction(id) {
  const txn = state.transactions.find((item) => item.txn_id.toUpperCase() === id.toUpperCase());
  if (!txn) throw Error(`Không tìm thấy giao dịch ${id}.`);
  return txn;
}

function addTransaction(channel, txn_type, amount, source = "", destination = "", bank = "", currency = "VND") {
  let id = 1;
  while (state.transactions.some((item) => item.txn_id === `TX${String(id).padStart(4, "0")}`)) id += 1;
  const txn = {
    txn_id: `TX${String(id).padStart(4, "0")}`, channel, txn_type, amount,
    created_at: new Date().toISOString(), sla_seconds: 120, source_account: source,
    destination_account: destination, counterparty_bank: bank, currency,
    status: "COMPLETED", sla_penalized: false, note: "Lệnh vận hành",
  };
  state.transactions.push(txn);
  state.processed_today += 1;
  state.score += 10;
  log(`${txn.txn_id} hoàn tất · +10 điểm.`);
  return txn;
}

function validateAml(amount, channel) {
  if (amount >= 500_000_000) {
    state.score -= 20;
    log(`Chặn ${channel}: cần rà soát AML · -20 điểm.`, "warning");
    throw Error("Giao dịch từ 500.000.000 VNĐ cần rà soát AML (ngưỡng mô phỏng).");
  }
}

function processTransaction(txn) {
  if (txn.status === "ON_HOLD") throw Error(`${txn.txn_id} đang treo; cần tra soát trước.`);
  if (txn.status !== "PENDING") throw Error(`${txn.txn_id} đã ở trạng thái ${txn.status}.`);
  let source;
  let destination;
  let debit = 0;
  if (txn.txn_type === "DEPOSIT") {
    destination = account(txn.destination_account);
  } else if (txn.txn_type === "WITHDRAWAL" || txn.txn_type === "ATM_WITHDRAWAL") {
    source = account(txn.source_account);
    debit = txn.amount;
  } else if (txn.txn_type === "TRANSFER" || txn.txn_type === "NAPAS_TRANSFER") {
    source = account(txn.source_account);
    if (state.accounts[txn.destination_account]) destination = account(txn.destination_account);
    const fee = txn.txn_type === "NAPAS_TRANSFER" ? Math.min(20_000, Math.max(5_000, Math.floor(txn.amount / 10_000))) : 0;
    debit = txn.amount + fee;
  } else if (txn.txn_type === "SWIFT_TRANSFER") {
    source = account(txn.source_account);
    const fx = { USD: state.fx_usd_vnd, EUR: 26_800, JPY: 165 }[txn.currency] ?? state.fx_usd_vnd;
    const localAmount = txn.amount * fx;
    debit = localAmount + Math.max(10_000, Math.floor(localAmount * 0.003));
  } else {
    throw Error(`Chưa hỗ trợ loại giao dịch ${txn.txn_type}.`);
  }
  if (source && source.balance < debit) throw Error(`Số dư không đủ: ${fmt(source.balance)}.`);
  if (source) source.balance -= debit;
  if (destination && txn.txn_type === "DEPOSIT") destination.balance += txn.amount;
  if (destination && ["TRANSFER", "NAPAS_TRANSFER"].includes(txn.txn_type)) destination.balance += txn.amount;
  const due = new Date(txn.created_at).getTime() + txn.sla_seconds * 1000;
  let reward = "Quá SLA; không nhận điểm thưởng.";
  if (Date.now() <= due) {
    state.score += 10;
    reward = "+10 điểm.";
    log(`${txn.txn_id} xử lý đúng hạn · +10 điểm.`);
  } else {
    if (!txn.sla_penalized) state.score -= 10;
    txn.sla_penalized = true;
    log(`${txn.txn_id} xử lý quá SLA · -10 điểm.`, "warning");
  }
  txn.status = "COMPLETED";
  state.processed_today += 1;
  return `Đã xử lý ${txn.txn_id} (${txn.channel}, ${txn.currency === "VND" ? fmt(txn.amount) : `${txn.amount} ${txn.currency}`}). ${reward}`;
}

function commandHelp() {
  return [
    "LỆNH VẬN HÀNH · Gõ lệnh rồi Enter",
    "  help | status | list-accounts",
    "  open-account <cif> <CASA|TIETKIEM|LOAN>",
    "  deposit <acc> <amount> | withdraw <acc> <amount>",
    "  transfer <from> <to> <amount>",
    "  napas <from> <bank> <acc> <amount> (cấp 2+)",
    "  swift <from> <bic> <amount> <USD|EUR|JPY> (cấp 3+)",
    "  process <txn_id> | resolve <incident_id> <action>",
    "  loan-disburse <loan_id> <amount> | loan-repay <loan_id> <amount>",
    "  classify-loan <loan_id> <1-5> | interest-calc <acc> | fee-calc <txn_id>",
    "  eod-batch | reconcile | report-sbv | audit <txn_id>",
    "  freeze <acc> | unfreeze <acc> | save | load | next-day | quit",
    "Số tiền là VND nguyên; có thể nhập 1.000.000 hoặc 1000000.",
  ].join("\n");
}

function runCommand(raw) {
  const args = raw.trim().split(/\s+/).filter(Boolean);
  const command = (args.shift() ?? "").toLowerCase();
  const need = (count, usage) => {
    if (args.length !== count) throw Error(`Cú pháp: ${usage}`);
  };
  if (!command) return "";
  switch (command) {
    case "help": return commandHelp();
    case "quit": return "Phiên web được lưu tự động trong trình duyệt. Đóng tab để thoát.";
    case "status": {
      const queue = state.transactions.filter((item) => ["PENDING", "ON_HOLD"].includes(item.status)).length;
      const open = state.incidents.filter((item) => item.status === "OPEN").length;
      return `Ngày ${state.day_number} · ${LEVELS[state.level - 1]} · ${state.score} điểm\nHệ thống ${state.system_status} · Hàng đợi ${queue} · Sự cố mở ${open}\nĐã xử lý ${state.processed_today} giao dịch · Dự trữ ${fmt(state.cash_reserve)}`;
    }
    case "list-accounts":
      return Object.values(state.accounts).map((item) => `${item.number}  ${item.account_type.padEnd(9)} ${state.customers[item.cif]?.name ?? item.cif}  ${fmt(item.balance)}  ${item.frozen ? "FROZEN" : item.status}`).join("\n");
    case "open-account": {
      need(2, "open-account <cif> <CASA|TIETKIEM|LOAN>");
      if (!state.customers[args[0]]) throw Error(`Không tìm thấy CIF ${args[0]}.`);
      const type = args[1].toUpperCase();
      if (!["CASA", "TIETKIEM", "LOAN"].includes(type)) throw Error("Loại tài khoản hợp lệ: CASA, TIETKIEM, LOAN.");
      const number = String(Math.max(...Object.keys(state.accounts).map(Number)) + 1);
      state.accounts[number] = { number, cif: args[0], account_type: type, balance: 0, currency: "VND", frozen: false, status: "ACTIVE" };
      log(`Mở tài khoản ${number} (${type}) cho CIF ${args[0]}.`);
      return `Đã mở tài khoản ${number}${type === "LOAN" ? " (chưa có hạn mức tín dụng)" : ""}.`;
    }
    case "deposit":
    case "withdraw": {
      need(2, `${command} <acc> <amount>`);
      const item = account(args[0]);
      const value = amountArg(args[1]);
      validateAml(value, "TELLER");
      if (command === "deposit") item.balance += value;
      else {
        if (item.balance < value) throw Error(`Số dư không đủ: ${fmt(item.balance)}.`);
        item.balance -= value;
      }
      const txn = addTransaction("TELLER", command === "deposit" ? "DEPOSIT" : "WITHDRAWAL", value, command === "withdraw" ? args[0] : "", command === "deposit" ? args[0] : "");
      return `${command === "deposit" ? "Nộp" : "Rút"} ${fmt(value)} · số dư ${fmt(item.balance)}. [${txn.txn_id}]`;
    }
    case "transfer": {
      need(3, "transfer <from> <to> <amount>");
      const source = account(args[0]);
      const target = account(args[1]);
      const value = amountArg(args[2]);
      validateAml(value, "chuyển khoản nội bộ");
      if (source.balance < value) throw Error(`Số dư không đủ: ${fmt(source.balance)}.`);
      source.balance -= value;
      target.balance += value;
      const txn = addTransaction("MOBILE", "TRANSFER", value, args[0], args[1]);
      return `Chuyển ${fmt(value)} ${args[0]} → ${args[1]}. [${txn.txn_id}]`;
    }
    case "napas": {
      need(4, "napas <from> <bank> <acc> <amount>");
      requireLevel(2, "NAPAS");
      const source = account(args[0]);
      const bank = args[1].toUpperCase();
      if (!BANKS.includes(bank)) throw Error(`Mã ngân hàng hợp lệ: ${BANKS.join(", ")}.`);
      const value = amountArg(args[3]);
      validateAml(value, "NAPAS");
      const fee = Math.min(20_000, Math.max(5_000, Math.floor(value / 10_000)));
      if (source.balance < value + fee) throw Error("Số dư không đủ cả phí NAPAS.");
      source.balance -= value + fee;
      const txn = addTransaction("NAPAS", "NAPAS_TRANSFER", value, args[0], args[2], bank);
      return `NAPAS ${fmt(value)} tới ${bank}/${args[2]}, phí ${fmt(fee)}. [${txn.txn_id}]`;
    }
    case "swift": {
      need(4, "swift <from> <swift_code> <amount> <currency>");
      requireLevel(3, "SWIFT");
      const source = account(args[0]);
      const bic = args[1].toUpperCase();
      if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) throw Error("Mã SWIFT/BIC phải có 8 hoặc 11 ký tự.");
      const value = amountArg(args[2]);
      const currency = args[3].toUpperCase();
      const fx = { USD: state.fx_usd_vnd, EUR: 26_800, JPY: 165 }[currency];
      if (!fx) throw Error("Ngoại tệ hỗ trợ: USD, EUR, JPY.");
      const local = value * fx;
      validateAml(local, "SWIFT");
      const fee = Math.max(10_000, Math.floor(local * 0.003));
      if (source.balance < local + fee) throw Error("Số dư không đủ cho SWIFT và phí.");
      source.balance -= local + fee;
      const txn = addTransaction("SWIFT", "SWIFT_TRANSFER", value, args[0], bic, "", currency);
      return `SWIFT ${value} ${currency} tới ${bic}; phí ${fmt(fee)}. [${txn.txn_id}]`;
    }
    case "process": {
      need(1, "process <txn_id>");
      return processTransaction(transaction(args[0]));
    }
    case "resolve": {
      need(2, "resolve <incident_id> <action>");
      const incident = state.incidents.find((item) => item.incident_id.toUpperCase() === args[0].toUpperCase());
      if (!incident || incident.status !== "OPEN") throw Error(`Không tìm thấy sự cố mở ${args[0]}.`);
      if (incident.required_action !== args[1].toLowerCase()) {
        state.score -= 5;
        throw Error(`Sai quy trình: dùng action '${incident.required_action}'. -5 điểm.`);
      }
      if (incident.related_txn) {
        const held = transaction(incident.related_txn);
        if (held.status === "ON_HOLD") held.status = "PENDING";
      }
      if (incident.required_action === "reconcile") runCommand("reconcile");
      if (incident.title === "Tấn công DDoS") state.system_status = "ONLINE";
      if (incident.title === "Tỷ giá biến động") state.fx_usd_vnd += state.day_number % 2 ? 100 : -100;
      if (incident.title === "Lãi suất thay đổi") {
        for (const key of Object.keys(state.interest_rates)) state.interest_rates[key] += 0.0005;
      }
      if (incident.title === "Khủng hoảng thanh khoản") state.cash_reserve += 1_000_000_000;
      incident.status = "RESOLVED";
      state.score += 5;
      log(`Đã xử lý sự cố ${incident.incident_id} · +5 điểm.`);
      return `Đã xử lý ${incident.title}. +5 điểm.`;
    }
    case "loan-disburse": {
      need(2, "loan-disburse <loan_id> <amount>");
      requireLevel(4, "Tín dụng");
      const loan = state.loans[args[0].toUpperCase()];
      if (!loan) throw Error(`Không tìm thấy khoản vay ${args[0]}.`);
      const value = amountArg(args[1]);
      if (value > loan.principal - loan.outstanding) throw Error("Vượt hạn mức giải ngân còn lại.");
      if (value > state.cash_reserve) throw Error("Dự trữ thanh khoản không đủ để giải ngân.");
      loan.outstanding += value;
      state.cash_reserve -= value;
      const customerAccount = Object.values(state.accounts).find((item) => item.cif === loan.cif && item.account_type !== "LOAN");
      if (customerAccount) customerAccount.balance += value;
      state.score += 10;
      return `Giải ngân ${fmt(value)} khoản ${loan.loan_id}. +10 điểm.`;
    }
    case "loan-repay": {
      need(2, "loan-repay <loan_id> <amount>");
      requireLevel(4, "Tín dụng");
      const loan = state.loans[args[0].toUpperCase()];
      if (!loan) throw Error(`Không tìm thấy khoản vay ${args[0]}.`);
      const value = amountArg(args[1]);
      const customerAccount = Object.values(state.accounts).find((item) => item.cif === loan.cif && item.account_type !== "LOAN");
      if (!customerAccount || customerAccount.balance < value) throw Error("Tài khoản thanh toán không đủ số dư.");
      const repaid = Math.min(value, loan.outstanding);
      customerAccount.balance -= repaid;
      loan.outstanding -= repaid;
      state.cash_reserve += repaid;
      state.score += 10;
      return `Thu nợ ${fmt(repaid)} khoản ${loan.loan_id}; dư nợ ${fmt(loan.outstanding)}. +10 điểm.`;
    }
    case "classify-loan": {
      need(2, "classify-loan <loan_id> <1-5>");
      requireLevel(4, "Phân loại nợ");
      const loan = state.loans[args[0].toUpperCase()];
      const group = Number(args[1]);
      if (!loan || !Number.isInteger(group) || group < 1 || group > 5) throw Error("Khoản vay hoặc nhóm nợ không hợp lệ.");
      loan.debt_group = group;
      state.score += 10;
      return `${loan.loan_id}: nhóm nợ ${group}. +10 điểm.`;
    }
    case "interest-calc": {
      need(1, "interest-calc <acc>");
      const item = account(args[0]);
      const rate = state.interest_rates[item.account_type === "CASA" ? "KHONGKYHAN" : "1M"];
      return `Lãi ước tính 1 ngày (${(rate * 100).toFixed(2)}%/năm): ${fmt(Math.floor(item.balance * rate / 365))}. Chưa hạch toán.`;
    }
    case "fee-calc": {
      need(1, "fee-calc <txn_id>");
      const txn = transaction(args[0]);
      const fee = txn.channel === "NAPAS" ? Math.min(20_000, Math.max(5_000, Math.floor(txn.amount / 10_000))) :
        txn.channel === "SWIFT" ? Math.max(10_000, Math.floor(txn.amount * ({ USD: state.fx_usd_vnd, EUR: 26_800, JPY: 165 }[txn.currency] ?? 1) * 0.003)) : 0;
      return `Phí tham chiếu ${txn.txn_id}: ${fmt(fee)} (không tự hạch toán).`;
    }
    case "eod-batch": {
      if (state.day_closed) return "Ca trực đã đóng EOD; dùng next-day.";
      const pending = state.transactions.filter((item) => ["PENDING", "ON_HOLD"].includes(item.status)).length;
      if (pending) state.score -= 5;
      let credited = 0;
      for (const item of Object.values(state.accounts)) {
        if (item.status !== "ACTIVE" || item.frozen || item.account_type === "LOAN") continue;
        const rate = state.interest_rates[item.account_type === "CASA" ? "KHONGKYHAN" : "1M"];
        const interest = Math.floor(item.balance * rate / 365);
        item.balance += interest;
        credited += interest;
      }
      state.day_closed = true;
      log(`EOD hoàn tất: ${pending} giao dịch chờ · lãi mô phỏng ${fmt(credited)}.`);
      return `EOD hoàn tất. Còn ${pending} giao dịch chờ; lãi mô phỏng ${fmt(credited)}.`;
    }
    case "reconcile": {
      need(0, "reconcile");
      if (state.ledger_mismatch) {
        const difference = state.ledger_mismatch;
        state.ledger_mismatch = 0;
        state.score -= 50;
        log(`Đối chiếu lệch ${fmt(difference)} · -50 điểm.`, "error");
        return `CẢNH BÁO: phát hiện chênh lệch ${fmt(difference)}; -50 điểm.`;
      }
      return `Đối chiếu thành công. Tổng CASA/TK ${fmt(Object.values(state.accounts).filter((item) => item.account_type !== "LOAN").reduce((sum, item) => sum + item.balance, 0))}.`;
    }
    case "report-sbv": {
      requireLevel(2, "Báo cáo NHNN");
      const pending = state.transactions.filter((item) => ["PENDING", "ON_HOLD"].includes(item.status)).length;
      const groups = [1, 2, 3, 4, 5].map((group) => `Nhóm ${group}: ${Object.values(state.loans).filter((loan) => loan.debt_group === group).length}`).join(" · ");
      return `BÁO CÁO NHNN · ${state.business_date}\nGiao dịch ${state.transactions.length} · Đã xử lý ca này ${state.processed_today} · Chờ ${pending}\n${groups}\nSự cố mở ${state.incidents.filter((item) => item.status === "OPEN").length} · Dự trữ ${fmt(state.cash_reserve)}\nBản mô phỏng, không thay thế báo cáo chính thức.`;
    }
    case "audit": {
      need(1, "audit <txn_id>");
      const txn = transaction(args[0]);
      return `${txn.txn_id}: ${txn.channel} · ${txn.txn_type} · ${txn.currency === "VND" ? fmt(txn.amount) : `${txn.amount} ${txn.currency}`} · ${txn.status} · SLA ${txn.sla_seconds}s · ${txn.created_at}`;
    }
    case "freeze":
    case "unfreeze": {
      need(1, `${command} <acc>`);
      const item = account(args[0], true);
      item.frozen = command === "freeze";
      log(`${command === "freeze" ? "Phong tỏa" : "Giải tỏa"} ${args[0]}.`);
      return `${command === "freeze" ? "Phong tỏa" : "Giải tỏa"} ${args[0]} thành công.`;
    }
    case "save":
      need(0, "save");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return "Đã lưu trạng thái trong bộ nhớ trình duyệt (localStorage).";
    case "load": {
      need(0, "load");
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) throw Error("Chưa có save trong trình duyệt này.");
      state = JSON.parse(saved);
      rebaseTimer();
      return "Đã tải trạng thái đã lưu.";
    }
    case "next-day": {
      need(0, "next-day");
      if (!state.day_closed) runCommand("eod-batch");
      state.day_number += 1;
      const date = new Date(`${state.business_date}T12:00:00`);
      date.setDate(date.getDate() + 1);
      state.business_date = localDateString(date);
      state.level = Math.max(state.level, Math.min(6, 1 + Math.floor((state.day_number - 1) / 2)));
      state.day_elapsed_seconds = 0;
      state.day_closed = false;
      state.processed_today = 0;
      lastEventAt = 0;
      lastIncidentAt = 0;
      startedAt = performance.now();
      for (let i = 0; i < Math.min(3, state.day_number); i += 1) generateTransaction();
      log(`Bắt đầu ngày ${state.day_number}, cấp ${state.level}.`);
      return `Đã mở ca ngày ${state.day_number} · cấp ${state.level} (${LEVELS[state.level - 1]}).`;
    }
    default: throw Error(`Lệnh không rõ: ${command}. Gõ help.`);
  }
}

function generateTransaction() {
  const accounts = Object.values(state.accounts).filter((item) => item.status === "ACTIVE" && item.account_type !== "LOAN");
  if (!accounts.length) return;
  const channelList = ["TELLER", "ATM/CDM", "MOBILE"];
  if (state.level >= 2) channelList.push("NAPAS");
  if (state.level >= 3) channelList.push("SWIFT");
  const channel = channelList[Math.floor(rng() * channelList.length)];
  const source = accounts[Math.floor(rng() * accounts.length)];
  const target = accounts[Math.floor(rng() * accounts.length)];
  const type = channel === "ATM/CDM" ? "WITHDRAWAL" :
    ["MOBILE", "NAPAS"].includes(channel) ? "TRANSFER" :
      channel === "SWIFT" ? "SWIFT_TRANSFER" : "DEPOSIT";
  const bank = channel === "NAPAS" ? BANKS[Math.floor(rng() * BANKS.length)] : "";
  const currencies = ["USD", "EUR", "JPY"];
  const currency = channel === "SWIFT" ? currencies[Math.floor(rng() * currencies.length)] : "VND";
  const value = channel === "SWIFT" ? [25, 50, 100, 250][Math.floor(rng() * 4)] :
    [250_000, 500_000, 1_000_000, 2_500_000][Math.floor(rng() * 4)];
  let id = 1;
  while (state.transactions.some((item) => item.txn_id === `TX${String(id).padStart(4, "0")}`)) id += 1;
  const txn = {
    txn_id: `TX${String(id).padStart(4, "0")}`, channel, txn_type: type, amount: value,
    created_at: new Date().toISOString(), sla_seconds: 45 + Math.floor(rng() * 76),
    source_account: source.number, destination_account: type === "TRANSFER" ? target.number :
      type === "SWIFT_TRANSFER" ? (rng() < 0.5 ? "BFTVVNVX" : "ICBVVNVX") : "",
    counterparty_bank: bank, currency, status: "PENDING", sla_penalized: false,
    note: "Giao dịch tự động",
  };
  state.transactions.push(txn);
  log(`Giao dịch mới ${txn.txn_id} ${channel} · ${currency === "VND" ? fmt(value) : `${value} ${currency}`}.`);
}

function generateIncident() {
  const [title, description, required_action] = INCIDENTS[Math.floor(rng() * INCIDENTS.length)];
  let id = 1;
  while (state.incidents.some((item) => item.incident_id === `INC${String(id).padStart(4, "0")}`)) id += 1;
  const incident = {
    incident_id: `INC${String(id).padStart(4, "0")}`, title, description, required_action,
    created_at: new Date().toISOString(), severity: ["Rò rỉ dữ liệu", "NHNN thanh tra"].includes(title) ? "CRITICAL" : "WARNING",
    status: "OPEN", related_txn: "",
  };
  if (title === "NAPAS timeout") {
    const txn = state.transactions.find((item) => item.channel === "NAPAS" && item.status === "PENDING");
    if (txn) {
      txn.status = "ON_HOLD";
      txn.note = "NAPAS timeout; cần tra soát";
      incident.related_txn = txn.txn_id;
    }
  }
  if (title === "Sai lệch số dư") state.ledger_mismatch = [125_000, 500_000, 1_250_000][Math.floor(rng() * 3)];
  if (title === "Khủng hoảng thanh khoản") state.cash_reserve = Math.max(0, state.cash_reserve - 1_000_000_000);
  if (title === "Tấn công DDoS") state.system_status = "DEGRADED";
  state.incidents.push(incident);
  log(`CẢNH BÁO [${incident.incident_id}] ${title}: ${description}`, "warning");
}

function advance(elapsed) {
  if (state.day_closed) return;
  state.day_elapsed_seconds = elapsed;
  const interval = Math.max(8, 24 - state.level * 2);
  while (elapsed - lastEventAt >= interval) {
    lastEventAt += interval;
    generateTransaction();
  }
  if (elapsed - lastIncidentAt >= 35) {
    lastIncidentAt = elapsed;
    if (rng() < Math.min(0.8, 0.22 + state.level * 0.08)) generateIncident();
  }
  for (const txn of state.transactions) {
    if (!["PENDING", "ON_HOLD"].includes(txn.status) || txn.sla_penalized) continue;
    if (Date.now() > new Date(txn.created_at).getTime() + txn.sla_seconds * 1000) {
      txn.sla_penalized = true;
      state.score -= 10;
      log(`SLA QUÁ HẠN ${txn.txn_id}: -10 điểm.`, "warning");
    }
  }
}

function rebaseTimer() {
  startedAt = performance.now() - state.day_elapsed_seconds * 1000;
  lastEventAt = Math.floor(state.day_elapsed_seconds / Math.max(8, 24 - state.level * 2)) * Math.max(8, 24 - state.level * 2);
  lastIncidentAt = Math.floor(state.day_elapsed_seconds / 35) * 35;
}

function maybeLevelUp() {
  let next = state.level;
  for (let index = 0; index < THRESHOLDS.length; index += 1) {
    if (state.score >= THRESHOLDS[index]) next = Math.max(next, index + 1);
  }
  if (next > state.level) {
    state.level = next;
    log(`Thăng cấp ${next}: ${LEVELS[next - 1]}.`);
  }
}

function addText(parent, tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function render() {
  const pending = state.transactions.filter((item) => ["PENDING", "ON_HOLD"].includes(item.status));
  const incidents = state.incidents.filter((item) => item.status === "OPEN");
  $("#metric-date").textContent = `${state.business_date} · Ngày ${state.day_number}`;
  $("#metric-level").textContent = `Cấp ${state.level} · ${LEVELS[state.level - 1]}`;
  $("#metric-score").textContent = state.score.toLocaleString("vi-VN");
  $("#metric-processed").textContent = `${state.processed_today} giao dịch đã xử lý`;
  $("#metric-queue").textContent = String(pending.length);
  $("#metric-incidents").textContent = `${incidents.length} sự cố đang mở`;
  $("#metric-reserve").textContent = fmt(state.cash_reserve);
  $("#metric-fx").textContent = `1 USD = ${state.fx_usd_vnd.toLocaleString("vi-VN")} VND`;
  $("#system-state").textContent = `● ${state.system_status}`;
  $("#system-state").classList.toggle("degraded", state.system_status !== "ONLINE");

  const body = $("#queue-body");
  body.replaceChildren();
  for (const txn of pending.slice(0, 7)) {
    const row = document.createElement("tr");
    const identity = `${txn.txn_id} / ${txn.channel}`;
    const money = txn.currency === "VND" ? fmt(txn.amount) : `${txn.amount.toLocaleString("vi-VN")} ${txn.currency}`;
    const remaining = Math.ceil((new Date(txn.created_at).getTime() + txn.sla_seconds * 1000 - Date.now()) / 1000);
    for (const value of [identity, txn.txn_type, money, remaining > 0 ? `${remaining}s` : "QUÁ HẠN"]) {
      addText(row, "td", "", value);
    }
    const statusCell = document.createElement("td");
    addText(statusCell, "span", `status-pill${txn.status === "ON_HOLD" ? " hold" : ""}`, txn.status === "ON_HOLD" ? "TRA SOÁT" : "PENDING");
    row.append(statusCell);
    body.append(row);
  }
  if (!pending.length) addText(body, "tr", "empty", "Hàng đợi đã trống. Các giao dịch mới sẽ xuất hiện tự động.");

  const logs = $("#event-log");
  logs.replaceChildren();
  for (const item of [...state.logs].reverse().slice(0, 8)) {
    const line = document.createElement("div");
    line.className = `event-line ${item.type}`;
    addText(line, "b", "", item.time);
    line.append(document.createTextNode(item.message));
    logs.append(line);
  }
  const list = $("#incident-list");
  list.replaceChildren();
  if (!incidents.length) addText(list, "div", "empty", "Không có sự cố đang mở.");
  for (const item of incidents.slice(-4).reverse()) {
    const card = addText(list, "div", "incident", "");
    addText(card, "strong", "", `${item.incident_id} · ${item.title}`);
    addText(card, "div", "", item.description);
    const button = addText(card, "button", "", `resolve ${item.incident_id} ${item.required_action}`);
    button.type = "button";
    button.addEventListener("click", () => submitCommand(button.textContent));
  }

  const elapsed = Math.min(state.day_minutes * 60, state.day_elapsed_seconds);
  const duration = state.day_minutes * 60;
  const gameSeconds = Math.floor(elapsed / duration * 8 * 60 * 60);
  const hour = 9 + Math.floor(gameSeconds / 3600);
  const minute = Math.floor((gameSeconds % 3600) / 60);
  const second = gameSeconds % 60;
  $("#shift-clock").textContent = [hour, minute, second].map((value) => String(value).padStart(2, "0")).join(":");
  const ratio = duration ? elapsed / duration : 0;
  $("#shift-progress").style.width = `${Math.min(100, ratio * 100)}%`;
  $("#shift-remaining").textContent = state.day_closed ? "Ca trực đã đóng" :
    `${Math.ceil(Math.max(0, duration - elapsed))} giây thực còn lại`;
}

function submitCommand(command) {
  if (!command.trim()) return;
  log(`corebank> ${command}`);
  try {
    const result = runCommand(command);
    if (result) log(result, result.startsWith("CẢNH BÁO") ? "warning" : "");
  } catch (error) {
    log(`LỖI NGHIỆP VỤ: ${error.message}`, "error");
  }
  maybeLevelUp();
  render();
}

function init(data) {
  const stored = localStorage.getItem(STORAGE_KEY);
  try {
    state = stored ? JSON.parse(stored) : createState(data, Number($("#shift-length").value));
    if (!state.interest_rates) state.interest_rates = { ...RATES };
    $("#shift-length").value = String(state.day_minutes);
    rebaseTimer();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    state = createState(data, Number($("#shift-length").value));
  }
  log(`Ca trực ngày ${state.day_number} bắt đầu · ${state.transactions.length} giao dịch mẫu.`);
  $("#command-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#command-input");
    const command = input.value;
    input.value = "";
    submitCommand(command);
  });
  $("#help-button").addEventListener("click", () => {
    log(commandHelp());
    render();
    $("#command-input").focus();
  });
  for (const button of document.querySelectorAll("[data-command]")) {
    button.addEventListener("click", () => submitCommand(button.dataset.command));
  }
  $("#shift-length").addEventListener("change", () => {
    state.day_minutes = Number($("#shift-length").value);
    if (!state.day_closed) rebaseTimer();
    render();
  });
  window.addEventListener("beforeunload", () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)));
  render();
  window.setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    advance(elapsed);
    if (elapsed >= state.day_minutes * 60 && !state.day_closed) submitCommand("eod-batch");
    render();
  }, 1000);
}

fetch("./data.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Không tải được data.json (${response.status}).`);
    return response.json();
  })
  .then(init)
  .catch((error) => {
    document.body.textContent = `Không thể khởi chạy simulator: ${error.message}`;
  });
