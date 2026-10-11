"""Nghiệp vụ mô phỏng core banking; không kết nối hệ thống ngân hàng thật."""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from events import BANKS, EventEngine, advance_day
from models import Account, GameState, Incident, Loan, Transaction, now_iso


LEVELS = (
    "Teller cơ bản", "Back-office", "Treasury", "Credit", "Crisis",
    "Audit & Compliance",
)
LEVEL_THRESHOLDS = (0, 50, 120, 220, 350, 500)
AML_REVIEW_LIMIT_VND = 500_000_000
DEBT_GROUPS = {
    1: "Nợ đủ tiêu chuẩn",
    2: "Nợ cần chú ý",
    3: "Nợ dưới tiêu chuẩn",
    4: "Nợ nghi ngờ",
    5: "Nợ có khả năng mất vốn",
}
INTEREST_RATES = {"KHONGKYHAN": 0.001, "1M": 0.026, "6M": 0.045, "12M": 0.055}


class BankingError(ValueError):
    """Lỗi nghiệp vụ có thể hiển thị an toàn trong CLI."""


def parse_amount(value: str) -> int:
    cleaned = value.strip().replace(".", "").replace(",", "")
    if not cleaned.isdigit() or int(cleaned) <= 0:
        raise BankingError("Số tiền phải là số nguyên dương, ví dụ 1000000.")
    return int(cleaned)


def format_vnd(amount: int) -> str:
    return f"{amount:,}".replace(",", ".") + " VNĐ"


class CoreBanking:
    def __init__(self, state: GameState, data_path: Path):
        self.state = state
        self.data_path = data_path
        self.engine = EventEngine(state)

    def log(self, message: str) -> None:
        self.state.logs.append(f"{now_iso()[11:19]}  {message}")
        self.state.logs = self.state.logs[-100:]

    def tick(self, elapsed_seconds: float) -> None:
        shift_seconds = self.state.day_minutes * 60
        self.engine.tick(min(elapsed_seconds, shift_seconds))
        if not self.state.day_closed and elapsed_seconds >= shift_seconds:
            self.log("Ca trực hết giờ; hệ thống tự chạy EOD.")
            self.eod_batch()

    def level_name(self) -> str:
        return LEVELS[self.state.level - 1]

    def _account(
        self, number: str, *, allow_frozen: bool = False, allow_loan: bool = False
    ) -> Account:
        account = self.state.accounts.get(number)
        if account is None:
            raise BankingError(f"Không tìm thấy tài khoản {number}.")
        if account.status != "ACTIVE":
            raise BankingError(f"Tài khoản {number} không hoạt động.")
        if account.account_type == "LOAN" and not allow_loan:
            raise BankingError("Tài khoản vay không dùng cho giao dịch CASA.")
        if account.frozen and not allow_frozen:
            raise BankingError(f"Tài khoản {number} đang bị phong tỏa.")
        return account

    def _available_balance(self, account: Account, amount: int) -> None:
        if account.balance < amount:
            raise BankingError(
                f"Số dư không đủ: hiện có {format_vnd(account.balance)}."
            )

    def _check_aml_limit(self, amount_vnd: int, channel: str) -> None:
        if amount_vnd >= AML_REVIEW_LIMIT_VND:
            self.state.score -= 20
            self.log(
                f"Chặn {channel}: vượt ngưỡng AML giả lập "
                f"{format_vnd(AML_REVIEW_LIMIT_VND)} · -20 điểm."
            )
            raise BankingError(
                f"Giao dịch vượt ngưỡng AML giả lập ({format_vnd(AML_REVIEW_LIMIT_VND)}); "
                "cần chuyển kiểm soát tuân thủ."
            )

    def open_account(self, cif: str, account_type: str) -> str:
        if cif not in self.state.customers:
            raise BankingError(f"Không tìm thấy CIF {cif}.")
        kind = account_type.upper()
        if kind not in {"CASA", "TIETKIEM", "LOAN"}:
            raise BankingError("Loại tài khoản hợp lệ: CASA, TIETKIEM, LOAN.")
        number = str(max(int(value) for value in self.state.accounts) + 1)
        self.state.accounts[number] = Account(number, cif, kind, 0)
        note = " (tài khoản chờ gắn khoản vay đã phê duyệt)" if kind == "LOAN" else ""
        self.log(f"Mở tài khoản {number} ({kind}) cho CIF {cif}{note}.")
        return number + (" (chưa có hạn mức tín dụng)" if kind == "LOAN" else "")

    def _new_transaction(
        self, channel: str, txn_type: str, amount: int, source: str = "",
        destination: str = "", bank: str = "", currency: str = "VND",
    ) -> Transaction:
        ids = [item.txn_id for item in self.state.transactions]
        number = 1
        while f"TX{number:04d}" in ids:
            number += 1
        txn = Transaction(
            txn_id=f"TX{number:04d}", channel=channel, txn_type=txn_type,
            amount=amount, created_at=now_iso(), sla_seconds=120,
            source_account=source, destination_account=destination,
            counterparty_bank=bank, currency=currency, status="COMPLETED",
            note="Tạo bởi lệnh vận hành",
        )
        self.state.transactions.append(txn)
        self.state.processed_today += 1
        self.state.score += 10
        self.log(f"{txn.txn_id} hoàn tất · +10 điểm.")
        return txn

    def deposit(self, account_number: str, amount: int) -> str:
        account = self._account(account_number)
        self._check_aml_limit(amount, "TELLER")
        account.balance += amount
        txn = self._new_transaction("TELLER", "DEPOSIT", amount, destination=account_number)
        return f"Nộp {format_vnd(amount)} vào {account_number}; số dư {format_vnd(account.balance)}. [{txn.txn_id}]"

    def withdraw(self, account_number: str, amount: int) -> str:
        account = self._account(account_number)
        self._check_aml_limit(amount, "TELLER")
        self._available_balance(account, amount)
        account.balance -= amount
        txn = self._new_transaction("TELLER", "WITHDRAWAL", amount, source=account_number)
        return f"Rút {format_vnd(amount)} từ {account_number}; số dư {format_vnd(account.balance)}. [{txn.txn_id}]"

    def transfer(self, source_number: str, target_number: str, amount: int) -> str:
        source = self._account(source_number)
        target = self._account(target_number)
        self._check_aml_limit(amount, "chuyển khoản nội bộ")
        if source.currency != target.currency:
            raise BankingError("Tài khoản nguồn và đích phải cùng loại tiền.")
        self._available_balance(source, amount)
        source.balance -= amount
        target.balance += amount
        txn = self._new_transaction(
            "MOBILE", "TRANSFER", amount, source_number, target_number
        )
        return f"Chuyển {format_vnd(amount)} {source_number} → {target_number}. [{txn.txn_id}]"

    def napas(self, source_number: str, bank: str, target: str, amount: int) -> str:
        if self.state.level < 2:
            raise BankingError("NAPAS mở từ cấp 2 (Back-office).")
        bank = bank.upper()
        if bank not in BANKS:
            raise BankingError(f"Mã ngân hàng không hợp lệ. Hỗ trợ: {', '.join(BANKS)}.")
        source = self._account(source_number)
        self._check_aml_limit(amount, "NAPAS")
        fee = min(20_000, max(5_000, amount // 10_000))
        self._available_balance(source, amount + fee)
        source.balance -= amount + fee
        txn = self._new_transaction(
            "NAPAS", "NAPAS_TRANSFER", amount, source_number, target, bank
        )
        return f"Napas {format_vnd(amount)} tới {bank}/{target}, phí {format_vnd(fee)}. [{txn.txn_id}]"

    def swift(self, source_number: str, swift_code: str, amount: int, currency: str) -> str:
        if self.state.level < 3:
            raise BankingError("SWIFT mở từ cấp 3 (Treasury).")
        if not re.fullmatch(r"[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?", swift_code.upper()):
            raise BankingError("Mã SWIFT/BIC không đúng định dạng 8 hoặc 11 ký tự.")
        currency = currency.upper()
        rates = {"USD": self.state.fx_usd_vnd, "EUR": 26_800, "JPY": 165}
        if currency not in rates:
            raise BankingError("Ngoại tệ hỗ trợ: USD, EUR, JPY.")
        account = self._account(source_number)
        value_vnd = amount * rates[currency]
        fee = max(10_000, int(value_vnd * 0.003))
        self._available_balance(account, value_vnd + fee)
        self._check_aml_limit(value_vnd, "SWIFT")
        account.balance -= value_vnd + fee
        txn = self._new_transaction(
            "SWIFT", "SWIFT_TRANSFER", amount, source_number, swift_code.upper(),
            currency=currency,
        )
        return f"SWIFT {amount:,} {currency} tới {swift_code.upper()}, quy đổi {format_vnd(value_vnd)}, phí {format_vnd(fee)}. [{txn.txn_id}]"

    def process(self, txn_id: str) -> str:
        txn = self._transaction(txn_id)
        if txn.status == "ON_HOLD":
            raise BankingError(f"{txn_id} đang treo; cần tra soát NAPAS trước.")
        if txn.status != "PENDING":
            raise BankingError(f"{txn_id} đã ở trạng thái {txn.status}.")
        if txn.txn_type == "DEPOSIT":
            self._account(txn.destination_account).balance += txn.amount
        elif txn.txn_type in ("WITHDRAWAL", "ATM_WITHDRAWAL"):
            source = self._account(txn.source_account)
            self._available_balance(source, txn.amount)
            source.balance -= txn.amount
        elif txn.txn_type in ("TRANSFER", "NAPAS_TRANSFER"):
            source = self._account(txn.source_account)
            destination = None
            if txn.destination_account in self.state.accounts:
                destination = self._account(txn.destination_account)
            fee = (
                min(20_000, max(5_000, txn.amount // 10_000))
                if txn.txn_type == "NAPAS_TRANSFER" else 0
            )
            self._available_balance(source, txn.amount + fee)
            source.balance -= txn.amount + fee
            if destination:
                destination.balance += txn.amount
        elif txn.txn_type == "SWIFT_TRANSFER":
            source = self._account(txn.source_account)
            rates = {"USD": self.state.fx_usd_vnd, "EUR": 26_800, "JPY": 165}
            value = txn.amount * rates.get(txn.currency, self.state.fx_usd_vnd)
            fee = max(10_000, int(value * 0.003))
            self._available_balance(source, value + fee)
            source.balance -= value + fee
        else:
            raise BankingError(f"Chưa hỗ trợ loại giao dịch {txn.txn_type}.")
        on_time = datetime.now() <= txn.due_at
        txn.status = "COMPLETED"
        self.state.processed_today += 1
        if on_time:
            self.state.score += 10
            self.log(f"{txn.txn_id} đã xử lý đúng hạn · +10 điểm.")
            score_message = "+10 điểm."
        else:
            if not txn.sla_penalized:
                self.state.score -= 10
                txn.sla_penalized = True
                self.log(f"{txn.txn_id} xử lý quá SLA · -10 điểm.")
            score_message = "Quá SLA; không nhận điểm thưởng."
        amount = (
            format_vnd(txn.amount) if txn.currency == "VND"
            else f"{txn.amount:,} {txn.currency}"
        )
        return f"Đã xử lý {txn_id} ({txn.channel}, {amount}). {score_message}"

    def _transaction(self, txn_id: str) -> Transaction:
        for txn in self.state.transactions:
            if txn.txn_id.upper() == txn_id.upper():
                return txn
        raise BankingError(f"Không tìm thấy giao dịch {txn_id}.")

    def calculate_interest(self, account_number: str) -> str:
        account = self._account(account_number)
        annual_rate = (
            self.state.interest_rates.get("KHONGKYHAN", 0.001)
            if account.account_type == "CASA"
            else self.state.interest_rates.get("1M", 0.026)
        )
        interest = int(account.balance * annual_rate / 365)
        self.log(f"Tính lãi mô phỏng {format_vnd(interest)} cho {account_number}.")
        return f"Lãi ước tính 1 ngày ({annual_rate * 100:.2f}%/năm): {format_vnd(interest)}. Chưa hạch toán."

    def calculate_fee(self, txn_id: str) -> str:
        txn = self._transaction(txn_id)
        fee = 0 if txn.channel in ("TELLER", "MOBILE", "ATM/CDM") else (
            min(20_000, max(5_000, txn.amount // 10_000))
            if txn.channel == "NAPAS" else max(
                10_000,
                int(
                    txn.amount
                    * {"USD": self.state.fx_usd_vnd, "EUR": 26_800, "JPY": 165}.get(
                        txn.currency, 1
                    )
                    * 0.003
                ),
            )
        )
        return f"Phí tham chiếu {txn_id}: {format_vnd(fee)} (không tự động hạch toán)."

    def loan_disburse(self, loan_id: str, amount: int) -> str:
        self._require_level(4, "Tín dụng")
        loan = self._loan(loan_id)
        if amount > loan.principal - loan.outstanding:
            raise BankingError("Số tiền vượt hạn mức giải ngân còn lại.")
        loan.outstanding += amount
        self.state.cash_reserve -= amount
        account = next((a for a in self.state.accounts.values() if a.cif == loan.cif and a.account_type != "LOAN"), None)
        if account:
            account.balance += amount
        return self._credit_action(f"Giải ngân {format_vnd(amount)} khoản {loan_id}.")

    def loan_repay(self, loan_id: str, amount: int) -> str:
        self._require_level(4, "Tín dụng")
        loan = self._loan(loan_id)
        account = next((a for a in self.state.accounts.values() if a.cif == loan.cif and a.account_type != "LOAN"), None)
        if account is None:
            raise BankingError("Khách hàng không có tài khoản thanh toán.")
        self._available_balance(account, amount)
        repayment = min(amount, loan.outstanding)
        account.balance -= repayment
        loan.outstanding -= repayment
        self.state.cash_reserve += repayment
        return self._credit_action(f"Thu nợ {format_vnd(repayment)} khoản {loan_id}; dư nợ {format_vnd(loan.outstanding)}.")

    def _credit_action(self, message: str) -> str:
        self.state.score += 10
        self.log(message + " +10 điểm.")
        return message

    def _loan(self, loan_id: str) -> Loan:
        try:
            return self.state.loans[loan_id.upper()]
        except KeyError as exc:
            raise BankingError(f"Không tìm thấy khoản vay {loan_id}.") from exc

    def _require_level(self, level: int, feature: str) -> None:
        if self.state.level < level:
            raise BankingError(f"{feature} mở từ cấp {level} ({LEVELS[level - 1]}).")

    def freeze(self, account_number: str, frozen: bool) -> str:
        account = self._account(account_number, allow_frozen=True)
        account.frozen = frozen
        action = "Phong tỏa" if frozen else "Giải tỏa"
        self.log(f"{action} tài khoản {account_number}.")
        return f"{action} tài khoản {account_number} thành công."

    def resolve(self, incident_id: str, action: str) -> str:
        incident = next(
            (item for item in self.state.incidents if item.incident_id.upper() == incident_id.upper()),
            None,
        )
        if incident is None:
            raise BankingError(f"Không tìm thấy sự cố {incident_id}.")
        if incident.status != "OPEN":
            raise BankingError(f"Sự cố {incident_id} đã được xử lý.")
        if action.lower() != incident.required_action:
            self.state.score -= 5
            raise BankingError(
                f"Sai quy trình: sự cố này yêu cầu '{incident.required_action}'. -5 điểm."
            )
        if incident.required_action == "reconcile":
            self.reconcile()
        if incident.related_txn:
            txn = self._transaction(incident.related_txn)
            if txn.status == "ON_HOLD":
                txn.status = "PENDING"
                txn.note = "Tra soát hoàn tất; chờ xử lý tiếp"
        incident.status = "RESOLVED"
        self.state.score += 5
        if incident.title == "Tấn công DDoS":
            self.state.system_status = "ONLINE"
        if incident.title == "Tỷ giá biến động":
            self.state.fx_usd_vnd += 100 if self.state.day_number % 2 else -100
        if incident.title == "Lãi suất thay đổi":
            self.state.interest_rates = {
                key: round(value + 0.0005, 5)
                for key, value in self.state.interest_rates.items()
            }
            self.log("Đã cập nhật biểu lãi suất mô phỏng.")
        if incident.title == "Khủng hoảng thanh khoản":
            self.state.cash_reserve += 1_000_000_000
            self.log("Đã điều chuyển nguồn vốn nội bộ để ổn định thanh khoản.")
        self.log(f"Đã xử lý sự cố {incident_id} bằng '{action}' · +5 điểm.")
        return f"Đã xử lý {incident.title}. +5 điểm."

    def eod_batch(self) -> str:
        if self.state.day_closed:
            return "Ca trực đã đóng EOD; dùng `next-day` để mở ngày mới."
        pending = sum(
            txn.status in ("PENDING", "ON_HOLD") for txn in self.state.transactions
        )
        if pending:
            self.state.score -= 5
            self.log(f"EOD phát hiện {pending} giao dịch chưa xử lý · -5 điểm.")
        # Mô phỏng kết chuyển lãi tiền gửi, chỉ áp dụng lãi một ngày.
        credited = 0
        for account in self.state.accounts.values():
            if account.status == "ACTIVE" and not account.frozen and account.balance > 0:
                rate = (
                    self.state.interest_rates.get("KHONGKYHAN", 0.001)
                    if account.account_type == "CASA"
                    else self.state.interest_rates.get("1M", 0.026)
                )
                interest = int(account.balance * rate / 365)
                account.balance += interest
                credited += interest
        self.log(
            f"EOD hoàn tất: {pending} pending; lãi mô phỏng {format_vnd(credited)}."
        )
        self.state.day_closed = True
        return f"EOD hoàn tất. Còn {pending} giao dịch chờ; lãi mô phỏng {format_vnd(credited)}."

    def reconcile(self) -> str:
        ledger_total = sum(account.balance for account in self.state.accounts.values() if account.account_type != "LOAN")
        mismatch = self.state.ledger_mismatch
        if mismatch:
            self.state.score -= 50
            self.state.ledger_mismatch = 0
            self.log(f"Đối chiếu lệch {format_vnd(mismatch)} · -50 điểm.")
            return f"CẢNH BÁO: phát hiện chênh lệch giao dịch chờ {format_vnd(mismatch)}; -50 điểm."
        self.log(f"Đối chiếu cân: tổng số dư tài khoản {format_vnd(ledger_total)}.")
        return f"Đối chiếu thành công. Tổng số dư CASA/TK: {format_vnd(ledger_total)}."

    def report_sbv(self) -> str:
        self._require_level(2, "Báo cáo NHNN")
        pending = sum(
            txn.status in ("PENDING", "ON_HOLD") for txn in self.state.transactions
        )
        open_incidents = sum(item.status == "OPEN" for item in self.state.incidents)
        group_summary = ", ".join(
            f"Nhóm {group}: {sum(loan.debt_group == group for loan in self.state.loans.values())}"
            for group in range(1, 6)
        )
        self.log("Đã lập báo cáo vận hành NHNN (bản mô phỏng).")
        return (
            f"BÁO CÁO NHNN · {self.state.business_date}\n"
            f"  Giao dịch trong hàng đợi: {len(self.state.transactions)}\n"
            f"  Đã xử lý ca này: {self.state.processed_today} | Chờ: {pending}\n"
            f"  Khoản vay theo nhóm nợ: {group_summary}\n"
            f"  Sự cố chưa đóng: {open_incidents} | Dự trữ: {format_vnd(self.state.cash_reserve)}\n"
            "  Đây là báo cáo giả lập, không thay thế biểu mẫu/khai báo chính thức."
        )

    def audit(self, txn_id: str) -> str:
        txn = self._transaction(txn_id)
        amount = (
            format_vnd(txn.amount) if txn.currency == "VND"
            else f"{txn.amount:,} {txn.currency}"
        )
        return (
            f"KIỂM TRA {txn.txn_id}: kênh={txn.channel}, loại={txn.txn_type}, "
            f"số tiền={amount}, trạng thái={txn.status}, "
            f"SLA={txn.sla_seconds}s, tạo lúc={txn.created_at}."
        )

    def classify_loan(self, loan_id: str, debt_group: int) -> str:
        self._require_level(4, "Phân loại nợ")
        loan = self._loan(loan_id)
        if debt_group not in DEBT_GROUPS:
            raise BankingError("Nhóm nợ hợp lệ: 1, 2, 3, 4 hoặc 5.")
        loan.debt_group = debt_group
        self.state.score += 10
        self.log(
            f"Phân loại {loan_id}: nhóm {debt_group} "
            f"({DEBT_GROUPS[debt_group]}) · +10 điểm."
        )
        return f"{loan_id}: nhóm {debt_group} – {DEBT_GROUPS[debt_group]}. +10 điểm."

    def save(self, path: Path) -> str:
        path.write_text(
            json.dumps(self.state.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return f"Đã lưu trạng thái vào {path}."

    @classmethod
    def load(cls, path: Path, data_path: Path) -> "CoreBanking":
        if not path.is_file():
            raise BankingError(f"Không tìm thấy file save: {path}")
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            state = GameState.from_dict(raw)
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            raise BankingError(f"File save không hợp lệ: {exc}") from exc
        game = cls(state, data_path)
        game.log(f"Đã tải trạng thái từ {path.name}.")
        return game

    def begin_next_day(self) -> str:
        if not self.state.day_closed:
            self.eod_batch()
        advance_day(self.state, self.engine)
        return f"Đã mở ca ngày {self.state.day_number} · cấp {self.state.level} ({self.level_name()})."

    def level_up(self) -> bool:
        current = self.state.level
        for level, threshold in enumerate(LEVEL_THRESHOLDS, start=1):
            if self.state.score >= threshold:
                self.state.level = max(self.state.level, level)
        if self.state.level > current:
            self.log(f"Thăng cấp {self.state.level}: {self.level_name()}.")
            return True
        return False

    def list_accounts(self) -> list[Account]:
        return sorted(self.state.accounts.values(), key=lambda account: account.number)

    def active_incidents(self) -> list[Incident]:
        return [item for item in self.state.incidents if item.status == "OPEN"]

    def pending_transactions(self) -> list[Transaction]:
        return [
            item for item in self.state.transactions
            if item.status in ("PENDING", "ON_HOLD")
        ]
