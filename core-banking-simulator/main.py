#!/usr/bin/env python3
"""Điểm vào game CORE BANKING SIMULATOR - Ngân hàng Lõi."""

from __future__ import annotations

import argparse
import shlex
import sys
import threading
import time
from pathlib import Path
from typing import Callable

from core_banking import BankingError, CoreBanking, format_vnd, parse_amount
from models import starting_state
from ui import TerminalUI


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data.json"
SAVE_PATH = BASE_DIR / "savegame.json"


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="CORE BANKING SIMULATOR - Ngân hàng Lõi")
    result.add_argument(
        "--day-minutes", type=float, default=5.0,
        help="Thời lượng một ngày làm việc theo phút thực tế (mặc định 5).",
    )
    result.add_argument("--no-color", action="store_true", help="Tắt màu ANSI.")
    result.add_argument("--load", nargs="?", const=str(SAVE_PATH), help="Tải save trước khi vào game.")
    return result


def handle_command(
    game: CoreBanking,
    ui: TerminalUI,
    parts: list[str],
    rebase_clock: Callable[[float], None] | None = None,
) -> bool:
    if not parts:
        return True
    command, args = parts[0].lower(), parts[1:]

    def require(count: int, usage: str) -> None:
        if len(args) != count:
            raise BankingError(f"Cú pháp: {usage}")

    if command in ("quit", "exit"):
        return False
    if command == "help":
        print(ui.help_text())
    elif command == "status":
        ui.print_status()
    elif command == "list-accounts":
        for account in game.list_accounts():
            customer = game.state.customers[account.cif]
            flags = "FROZEN" if account.frozen else account.status
            print(
                f"{account.number:<14} {account.account_type:<9} "
                f"{customer.name:<22} {format_vnd(account.balance):>20} "
                f"{account.currency} {flags}"
            )
    elif command == "open-account":
        require(2, "open-account <cif> <CASA|TIETKIEM|LOAN>")
        print(f"Đã mở tài khoản: {game.open_account(args[0], args[1])}")
    elif command in ("deposit", "withdraw"):
        require(2, f"{command} <acc> <amount>")
        amount = parse_amount(args[1])
        print(game.deposit(args[0], amount) if command == "deposit" else game.withdraw(args[0], amount))
    elif command == "transfer":
        require(3, "transfer <from> <to> <amount>")
        print(game.transfer(args[0], args[1], parse_amount(args[2])))
    elif command == "napas":
        require(4, "napas <from> <bank> <acc> <amount>")
        print(game.napas(args[0], args[1], args[2], parse_amount(args[3])))
    elif command == "swift":
        require(4, "swift <from> <swift_code> <amount> <currency>")
        print(game.swift(args[0], args[1], parse_amount(args[2]), args[3]))
    elif command == "process":
        require(1, "process <txn_id>")
        print(game.process(args[0]))
    elif command == "resolve":
        require(2, "resolve <incident_id> <action>")
        print(game.resolve(args[0], args[1]))
    elif command == "loan-disburse":
        require(2, "loan-disburse <loan_id> <amount>")
        print(game.loan_disburse(args[0], parse_amount(args[1])))
    elif command == "loan-repay":
        require(2, "loan-repay <loan_id> <amount>")
        print(game.loan_repay(args[0], parse_amount(args[1])))
    elif command == "classify-loan":
        require(2, "classify-loan <loan_id> <1-5>")
        try:
            group = int(args[1])
        except ValueError as exc:
            raise BankingError("Nhóm nợ phải là số nguyên từ 1 đến 5.") from exc
        print(game.classify_loan(args[0], group))
    elif command == "interest-calc":
        require(1, "interest-calc <acc>")
        print(game.calculate_interest(args[0]))
    elif command == "fee-calc":
        require(1, "fee-calc <txn_id>")
        print(game.calculate_fee(args[0]))
    elif command == "eod-batch":
        require(0, "eod-batch")
        print(game.eod_batch())
    elif command == "reconcile":
        require(0, "reconcile")
        print(game.reconcile())
    elif command == "report-sbv":
        require(0, "report-sbv")
        print(game.report_sbv())
    elif command == "audit":
        require(1, "audit <txn_id>")
        print(game.audit(args[0]))
    elif command in ("freeze", "unfreeze"):
        require(1, f"{command} <acc>")
        print(game.freeze(args[0], command == "freeze"))
    elif command in ("save", "load"):
        if len(args) > 1:
            raise BankingError(f"Cú pháp: {command} [file]")
        path = Path(args[0]) if args else SAVE_PATH
        if command == "save":
            print(game.save(path))
        else:
            loaded = CoreBanking.load(path, game.data_path)
            game.state = loaded.state
            game.engine = loaded.engine
            if rebase_clock:
                rebase_clock(game.state.day_elapsed_seconds)
            print(f"Đã tải trạng thái từ {path}.")
    elif command == "next-day":
        require(0, "next-day")
        print(game.eod_batch())
        print(game.begin_next_day())
        if rebase_clock:
            rebase_clock(0.0)
    else:
        raise BankingError(f"Lệnh không rõ: {command}. Gõ `help`.")
    game.level_up()
    return True


def run() -> int:
    args = parser().parse_args()
    if args.day_minutes <= 0:
        print("--day-minutes phải lớn hơn 0.", file=sys.stderr)
        return 2
    try:
        import json
        data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        if args.load:
            game = CoreBanking.load(Path(args.load), DATA_PATH)
        else:
            game = CoreBanking(starting_state(data, args.day_minutes), DATA_PATH)
    except (OSError, json.JSONDecodeError, BankingError) as exc:
        print(f"Không thể khởi tạo game: {exc}", file=sys.stderr)
        return 1

    ui = TerminalUI(game, color_enabled=not args.no_color)
    stop_ticker = threading.Event()
    time_origin = [time.monotonic() - game.state.day_elapsed_seconds]

    def rebase_clock(elapsed: float) -> None:
        time_origin[0] = time.monotonic() - elapsed

    def ticker() -> None:
        while not stop_ticker.wait(1):
            game.tick(time.monotonic() - time_origin[0])

    thread = threading.Thread(target=ticker, name="banking-clock", daemon=True)
    thread.start()
    print("\nCORE BANKING SIMULATOR - NGÂN HÀNG LÕI")
    print("Trò chơi nghiệp vụ giả lập; không kết nối hệ thống/ngân hàng thật.")
    print(f"Ca làm việc: {args.day_minutes:g} phút thực · lệnh `help` để bắt đầu.\n")
    ui.render()
    try:
        while True:
            try:
                line = ui.prompt()
            except EOFError:
                break
            try:
                if not handle_command(game, ui, shlex.split(line), rebase_clock):
                    break
            except BankingError as exc:
                print(f"LỖI NGHIỆP VỤ: {exc}")
            except (OSError, ValueError) as exc:
                print(f"LỖI: {exc}")
            ui.render()
    except KeyboardInterrupt:
        print("\nĐã nhận Ctrl-C.")
    finally:
        stop_ticker.set()
        thread.join(timeout=2)
    print("Kết thúc ca. Dùng `save` để lưu trước khi thoát.")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
