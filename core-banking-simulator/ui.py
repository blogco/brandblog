"""Giao diện terminal ANSI tương thích terminal hẹp khoảng 80 cột."""

from __future__ import annotations

import os
import shutil
import sys
import textwrap
from datetime import datetime

from core_banking import CoreBanking, format_vnd


RESET = "\033[0m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
CYAN = "\033[36m"


def color(text: str, code: str, enabled: bool = True) -> str:
    return f"{code}{text}{RESET}" if enabled else text


class TerminalUI:
    def __init__(self, game: CoreBanking, color_enabled: bool = True):
        self.game = game
        self.color_enabled = color_enabled
        self.width = min(100, max(60, shutil.get_terminal_size((80, 24)).columns))

    def _line(self, text: str = "") -> str:
        inner = self.width - 4
        visible = text[:inner]
        return "│ " + visible.ljust(inner) + " │"

    def _wrap(self, text: str, indent: str = "") -> list[str]:
        width = self.width - 6 - len(indent)
        return [indent + line for line in textwrap.wrap(text, width=width)] or [indent]

    def render(self) -> None:
        state = self.game.state
        pending = self.game.pending_transactions()
        online_color = GREEN if state.system_status == "ONLINE" else YELLOW
        top = "┌" + "─" * (self.width - 2) + "┐"
        divider = "├" + "─" * (self.width - 2) + "┤"
        bottom = "└" + "─" * (self.width - 2) + "┘"
        lines = [
            top,
            self._line(f"{state.bank_name} - CORE BANKING SIMULATOR"),
            self._line(
                f"Ngày {state.day_number} ({state.business_date}) | "
                f"{self._game_clock()} | Hệ thống: {state.system_status} | "
                f"Cấp {state.level}: {self.game.level_name()}"
            ),
            divider,
            self._line(f"HÀNG ĐỢI ({len(pending)}) · SỰ CỐ MỞ ({len(self.game.active_incidents())})"),
        ]
        for txn in pending[:5]:
            owner = txn.counterparty_bank or txn.destination_account or "—"
            amount = (
                format_vnd(txn.amount) if txn.currency == "VND"
                else f"{txn.amount:,} {txn.currency}"
            )
            item = (
                f"{txn.txn_id} {txn.channel:<8} {amount:>17} "
                f"{txn.source_account or '—'} → {owner} [{txn.status}]"
            )
            lines.append(self._line(item))
        if len(pending) > 5:
            lines.append(self._line(f"... còn {len(pending) - 5} giao dịch; dùng `status` để xem KPI."))
        lines.append(divider)
        for label, value in (
            ("Điểm / KPI", f"{state.score} điểm · {state.processed_today} giao dịch đã xử lý"),
            ("Dự trữ thanh khoản", format_vnd(state.cash_reserve)),
            ("Tỷ giá tham chiếu", f"1 USD = {state.fx_usd_vnd:,} VND"),
        ):
            lines.append(self._line(f"{label}: {value}"))
        lines.append(divider)
        lines.append(self._line("NHẬT KÝ VẬN HÀNH"))
        for message in state.logs[-3:]:
            lines.extend(self._line(line) for line in self._wrap(message))
        lines.extend((divider, self._line("Gõ `help` để xem lệnh | `process TX0001` xử lý giao dịch"), bottom))
        for line in lines:
            if "ONLINE" in line:
                print(color(line, online_color, self.color_enabled))
            elif "CẢNH BÁO" in line or "QUÁ HẠN" in line:
                print(color(line, YELLOW, self.color_enabled))
            else:
                print(line)

    def _game_clock(self) -> str:
        state = self.game.state
        day_real_seconds = state.day_minutes * 60
        game_seconds = int(
            (state.day_elapsed_seconds / max(day_real_seconds, 1)) * 8 * 60 * 60
        )
        hour, remainder = divmod(game_seconds, 3600)
        minute, second = divmod(remainder, 60)
        return f"{9 + hour:02d}:{minute:02d}:{second:02d}"

    def print_status(self) -> None:
        state = self.game.state
        pending = self.game.pending_transactions()
        print(
            f"Ngày {state.day_number} · cấp {state.level} · "
            f"{self.game.level_name()} · điểm {state.score}"
        )
        print(
            f"Hệ thống {state.system_status} | Hàng đợi {len(pending)} | "
            f"Đã xử lý {state.processed_today} | "
            f"Thanh khoản {format_vnd(state.cash_reserve)}"
        )
        print(
            f"Ca trực: {state.day_elapsed_seconds:.0f}/{state.day_minutes * 60:.0f}s "
            f"thực | 1 ngày game = 8 giờ vận hành"
        )
        for txn in pending[:12]:
            amount = (
                format_vnd(txn.amount) if txn.currency == "VND"
                else f"{txn.amount:,} {txn.currency}"
            )
            print(
                f"  {txn.txn_id:<7} {txn.channel:<8} {txn.txn_type:<16} "
                f"{amount:>17} SLA {txn.sla_seconds}s "
                f"{txn.source_account or '—'}"
            )
        for incident in self.game.active_incidents():
            print(
                f"  {color('SỰ CỐ', RED, self.color_enabled)} {incident.incident_id}: "
                f"{incident.title} · resolve {incident.incident_id} {incident.required_action}"
            )

    @staticmethod
    def help_text() -> str:
        return """LỆNH VẬN HÀNH
  help                                      Hiển thị trợ giúp
  status                                    Trạng thái, hàng đợi, KPI
  list-accounts                             Liệt kê tài khoản
  open-account <cif> <CASA|TIETKIEM|LOAN>  Mở tài khoản
  deposit <acc> <amount>                   Nộp tiền tại quầy
  withdraw <acc> <amount>                  Rút tiền
  transfer <from> <to> <amount>            Chuyển khoản nội bộ
  napas <from> <bank> <acc> <amount>        Chuyển liên ngân hàng (cấp 2+)
  swift <from> <bic> <amount> <USD|EUR|JPY> Chuyển quốc tế (cấp 3+)
  process <txn_id>                          Xử lý giao dịch đang chờ
  resolve <incident_id> <action>            Xử lý sự cố bằng action hiển thị
  loan-disburse <loan_id> <amount>          Giải ngân (cấp 4+)
  loan-repay <loan_id> <amount>             Thu nợ (cấp 4+)
  classify-loan <loan_id> <1-5>             Phân loại nợ (cấp 4+)
  interest-calc <acc>                       Ước tính lãi tiền gửi
  fee-calc <txn_id>                         Tra cứu phí tham chiếu
  eod-batch                                 Chạy kết chuyển cuối ngày
  reconcile                                 Đối chiếu giao dịch và số dư
  report-sbv                                Lập báo cáo NHNN mô phỏng (cấp 2+)
  audit <txn_id>                            Kiểm tra dấu vết giao dịch
  freeze <acc> / unfreeze <acc>              Phong tỏa / giải tỏa
  save [file] / load [file]                 Lưu / tải game (mặc định savegame.json)
  next-day                                  Kết thúc ca và chuyển ngày mới
  quit                                      Thoát game

amount chấp nhận cả 1000000 và 1.000.000. NAPAS: VCB, TCB, BIDV, CTG, ACB,
MB, VPB. Lệnh nghiệp vụ mô phỏng trên dữ liệu giả lập, không kết nối ngân hàng."""

    def prompt(self) -> str:
        return input(color("corebank> ", CYAN, self.color_enabled))
