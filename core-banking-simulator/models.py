"""Các mô hình dữ liệu và tiện ích lưu/đọc trạng thái game."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from typing import Any


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


@dataclass
class Customer:
    cif: str
    name: str
    identity: str
    phone: str


@dataclass
class Account:
    number: str
    cif: str
    account_type: str
    balance: int
    currency: str = "VND"
    frozen: bool = False
    status: str = "ACTIVE"


@dataclass
class Transaction:
    txn_id: str
    channel: str
    txn_type: str
    amount: int
    created_at: str
    sla_seconds: int
    source_account: str = ""
    destination_account: str = ""
    counterparty_bank: str = ""
    currency: str = "VND"
    status: str = "PENDING"
    sla_penalized: bool = False
    note: str = ""

    @property
    def due_at(self) -> datetime:
        return datetime.fromisoformat(self.created_at) + timedelta(
            seconds=self.sla_seconds
        )


@dataclass
class Incident:
    incident_id: str
    title: str
    description: str
    required_action: str
    created_at: str
    severity: str = "WARNING"
    status: str = "OPEN"
    related_txn: str = ""


@dataclass
class Loan:
    loan_id: str
    cif: str
    principal: int
    outstanding: int
    due_date: str
    debt_group: int = 1
    status: str = "ACTIVE"


@dataclass
class GameState:
    bank_name: str
    business_date: str
    day_number: int
    day_minutes: float
    day_elapsed_seconds: float
    score: int
    level: int
    system_status: str
    cash_reserve: int
    fx_usd_vnd: int
    day_closed: bool = False
    ledger_mismatch: int = 0
    interest_rates: dict[str, float] = field(default_factory=lambda: {
        "KHONGKYHAN": 0.001, "1M": 0.026, "6M": 0.045, "12M": 0.055
    })
    customers: dict[str, Customer] = field(default_factory=dict)
    accounts: dict[str, Account] = field(default_factory=dict)
    transactions: list[Transaction] = field(default_factory=list)
    incidents: list[Incident] = field(default_factory=list)
    loans: dict[str, Loan] = field(default_factory=dict)
    logs: list[str] = field(default_factory=list)
    processed_today: int = 0
    rng_seed: int = 20261011

    def to_dict(self) -> dict[str, Any]:
        return {
            **asdict(self),
            "customers": {key: asdict(value) for key, value in self.customers.items()},
            "accounts": {key: asdict(value) for key, value in self.accounts.items()},
            "transactions": [asdict(value) for value in self.transactions],
            "incidents": [asdict(value) for value in self.incidents],
            "loans": {key: asdict(value) for key, value in self.loans.items()},
        }

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "GameState":
        return cls(
            bank_name=raw["bank_name"],
            business_date=raw["business_date"],
            day_number=int(raw["day_number"]),
            day_minutes=float(raw["day_minutes"]),
            day_elapsed_seconds=float(raw.get("day_elapsed_seconds", 0)),
            day_closed=bool(raw.get("day_closed", False)),
            ledger_mismatch=int(raw.get("ledger_mismatch", 0)),
            interest_rates={
                key: float(value)
                for key, value in raw.get(
                    "interest_rates",
                    {"KHONGKYHAN": 0.001, "1M": 0.026, "6M": 0.045, "12M": 0.055},
                ).items()
            },
            score=int(raw.get("score", 0)),
            level=int(raw.get("level", 1)),
            system_status=raw.get("system_status", "ONLINE"),
            cash_reserve=int(raw.get("cash_reserve", 10_000_000_000)),
            fx_usd_vnd=int(raw.get("fx_usd_vnd", 24_500)),
            customers={
                key: Customer(**value) for key, value in raw.get("customers", {}).items()
            },
            accounts={
                key: Account(**value) for key, value in raw.get("accounts", {}).items()
            },
            transactions=[
                Transaction(**value) for value in raw.get("transactions", [])
            ],
            incidents=[Incident(**value) for value in raw.get("incidents", [])],
            loans={key: Loan(**value) for key, value in raw.get("loans", {}).items()},
            logs=list(raw.get("logs", [])),
            processed_today=int(raw.get("processed_today", 0)),
            rng_seed=int(raw.get("rng_seed", 20261011)),
        )


def starting_state(data: dict[str, Any], day_minutes: float) -> GameState:
    """Nạp bộ dữ liệu demo và tạo trạng thái game đầu tiên."""
    state = GameState(
        bank_name=data["bank_name"],
        business_date=date.today().isoformat(),
        day_number=1,
        day_minutes=day_minutes,
        day_elapsed_seconds=0,
        score=0,
        level=1,
        system_status="ONLINE",
        cash_reserve=int(data.get("cash_reserve", 10_000_000_000)),
        fx_usd_vnd=int(data.get("fx_usd_vnd", 24_500)),
        customers={
            row["cif"]: Customer(**row) for row in data.get("customers", [])
        },
        accounts={
            row["number"]: Account(**row) for row in data.get("accounts", [])
        },
        # Đặt thời điểm tạo theo lúc bắt đầu ván để SLA demo không phụ thuộc ngày chạy.
        transactions=[
            Transaction(**{**row, "created_at": now_iso()})
            for row in data.get("transactions", [])
        ],
        loans={row["loan_id"]: Loan(**row) for row in data.get("loans", [])},
        logs=[],
    )
    state.logs.append(
        f"{now_iso()[11:19]}  Ca trực ngày {state.day_number} bắt đầu. "
        f"{len(state.transactions)} giao dịch mẫu trong hàng đợi."
    )
    return state
