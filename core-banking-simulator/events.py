"""Sinh giao dịch và sự cố theo nhịp thời gian của ca trực."""

from __future__ import annotations

import random
from datetime import datetime

from models import Account, GameState, Incident, Transaction, now_iso


BANKS = ("VCB", "TCB", "BIDV", "CTG", "ACB", "MB", "VPB")
INCIDENTS = (
    ("NAPAS timeout", "Phản hồi NAPAS quá hạn; giao dịch cần tra soát.", "investigate"),
    ("ATM hết tiền", "Máy ATM CN Quận 1 còn dưới ngưỡng tiếp quỹ.", "dispatch"),
    ("Sai lệch số dư", "Phát hiện chênh lệch sổ phụ và sổ cái.", "reconcile"),
    ("Khách hàng khiếu nại", "Yêu cầu tra soát giao dịch từ Contact Center.", "respond"),
    ("Tấn công DDoS", "Độ trễ kênh ngân hàng số tăng cao.", "mitigate"),
    ("Rò rỉ dữ liệu", "Cảnh báo truy cập dữ liệu bất thường; cần báo cáo.", "report"),
    ("NHNN thanh tra", "Đoàn thanh tra yêu cầu trích xuất báo cáo.", "report"),
    ("Khủng hoảng thanh khoản", "Dự báo dòng tiền cuối ngày xuống dưới ngưỡng.", "balance"),
    ("Lãi suất thay đổi", "Thông báo cập nhật biểu lãi suất tiền gửi.", "update"),
    ("Tỷ giá biến động", "Tỷ giá USD/VND thay đổi trong phiên.", "update"),
)


def _next_id(prefix: str, existing: list[str]) -> str:
    used = set(existing)
    number = 1
    while f"{prefix}{number:04d}" in used:
        number += 1
    return f"{prefix}{number:04d}"


class EventEngine:
    """Mỗi lần gọi tick có thể thêm giao dịch, sự cố và xử lý SLA."""

    def __init__(self, state: GameState):
        self.state = state
        self.random = random.Random(state.rng_seed)
        self._last_event_at = state.day_elapsed_seconds
        self._last_incident_at = state.day_elapsed_seconds

    def tick(self, elapsed_seconds: float) -> None:
        if self.state.day_closed:
            return
        self.state.day_elapsed_seconds = max(self.state.day_elapsed_seconds, elapsed_seconds)
        # Tần suất tăng theo cấp độ nhưng không làm ngập hàng đợi ở ca ngắn.
        interval = max(8.0, 24.0 - self.state.level * 2)
        while self.state.day_elapsed_seconds - self._last_event_at >= interval:
            self._last_event_at += interval
            self._generate_transaction()
        if self.state.day_elapsed_seconds - self._last_incident_at >= 35:
            self._last_incident_at = self.state.day_elapsed_seconds
            if self.random.random() < min(0.8, 0.22 + self.state.level * 0.08):
                self._generate_incident()
        self._check_sla()

    def _generate_transaction(self) -> None:
        accounts = [
            item for item in self.state.accounts.values()
            if item.status == "ACTIVE" and item.account_type != "LOAN"
        ]
        if not accounts:
            return
        source = self.random.choice(accounts)
        channel_options = ["TELLER", "ATM/CDM", "MOBILE"]
        if self.state.level >= 2:
            channel_options.append("NAPAS")
        if self.state.level >= 3:
            channel_options.append("SWIFT")
        channel = self.random.choice(channel_options)
        txn_type = (
            "WITHDRAWAL" if channel == "ATM/CDM"
            else "TRANSFER" if channel in ("MOBILE", "NAPAS")
            else "SWIFT_TRANSFER" if channel == "SWIFT"
            else "DEPOSIT"
        )
        target = self.random.choice(accounts)
        txn_id = _next_id("TX", [item.txn_id for item in self.state.transactions])
        bank = self.random.choice(BANKS) if channel == "NAPAS" else ""
        currency = self.random.choice(("USD", "EUR", "JPY")) if channel == "SWIFT" else "VND"
        amount = (
            self.random.choice((25, 50, 100, 250))
            if channel == "SWIFT"
            else self.random.choice((250_000, 500_000, 1_000_000, 2_500_000))
        )
        bic = self.random.choice(("BFTVVNVX", "ICBVVNVX")) if channel == "SWIFT" else ""
        txn = Transaction(
            txn_id=txn_id,
            channel=channel,
            txn_type=txn_type,
            amount=amount,
            created_at=now_iso(),
            sla_seconds=self.random.randint(45, 120),
            source_account=source.number,
            destination_account=(
                target.number if txn_type == "TRANSFER"
                else bic if txn_type == "SWIFT_TRANSFER" else ""
            ),
            counterparty_bank=bank,
            currency=currency,
            note="Giao dịch phát sinh tự động",
        )
        self.state.transactions.append(txn)
        self.state.logs.append(
            f"{txn.created_at[11:19]}  Giao dịch mới {txn.txn_id} "
            f"{txn.channel} · {txn.amount:,} VNĐ"
        )

    def _generate_incident(self) -> None:
        title, description, action = self.random.choice(INCIDENTS)
        incident_id = _next_id("INC", [item.incident_id for item in self.state.incidents])
        incident = Incident(
            incident_id=incident_id,
            title=title,
            description=description,
            required_action=action,
            created_at=now_iso(),
            severity="CRITICAL" if title in ("Rò rỉ dữ liệu", "NHNN thanh tra") else "WARNING",
        )
        if title == "NAPAS timeout":
            held_txn = next(
                (
                    txn for txn in self.state.transactions
                    if txn.channel == "NAPAS" and txn.status == "PENDING"
                ),
                None,
            )
            if held_txn:
                held_txn.status = "ON_HOLD"
                held_txn.note = "Timeout NAPAS; cần tra soát trước khi xử lý tiếp"
                incident.related_txn = held_txn.txn_id
        self.state.incidents.append(incident)
        if title == "Sai lệch số dư":
            self.state.ledger_mismatch = self.random.choice((125_000, 500_000, 1_250_000))
        if title == "Khủng hoảng thanh khoản":
            self.state.cash_reserve = max(0, self.state.cash_reserve - 1_000_000_000)
        self.state.logs.append(
            f"{incident.created_at[11:19]}  CẢNH BÁO [{incident_id}] {title}"
        )
        if title == "Tấn công DDoS":
            self.state.system_status = "DEGRADED"

    def _check_sla(self) -> None:
        now = datetime.now()
        for txn in self.state.transactions:
            if txn.status in ("PENDING", "ON_HOLD") and not txn.sla_penalized and now > txn.due_at:
                txn.sla_penalized = True
                self.state.score -= 10
                self.state.logs.append(
                    f"{now.strftime('%H:%M:%S')}  SLA QUÁ HẠN {txn.txn_id}: -10 điểm"
                )


def advance_day(state: GameState, engine: EventEngine) -> None:
    """Bắt đầu ca mới; tăng độ khó và bổ sung luồng giao dịch."""
    from datetime import date, timedelta

    state.day_number += 1
    state.business_date = (
        date.fromisoformat(state.business_date) + timedelta(days=1)
    ).isoformat()
    day_level = min(6, 1 + max(0, (state.day_number - 1) // 2))
    state.level = max(state.level, day_level)
    state.day_elapsed_seconds = 0
    state.day_closed = False
    state.processed_today = 0
    engine._last_event_at = 0
    engine._last_incident_at = 0
    state.logs.append(
        f"{now_iso()[11:19]}  Bắt đầu ngày {state.day_number}, cấp {state.level}."
    )
    for _ in range(min(3, state.day_number)):
        engine._generate_transaction()
