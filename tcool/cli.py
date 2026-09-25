import argparse
import hashlib
import io
import json
import math
import sys
import time
from pathlib import Path

from pypdf import PdfReader

from . import __version__
from .browser import navigate_pdf, request, session
from .catalog import atomic_write, download_jobs, import_csv, parse_search, write_catalog


def parser():
    p = argparse.ArgumentParser(prog="tw-exams", description="自動搜尋 tcool 考卷、匯出清單並下載 PDF")
    p.add_argument("--version", action="version", version=__version__)
    subs = p.add_subparsers(dest="command", required=True)
    for name, help_text in [("login", "建立／更新獨立瀏覽器工作階段"),
                            ("options", "取得年級對應的篩選選項"),
                            ("search", "自動搜尋所有分頁並輸出 CSV、JSON"),
                            ("download", "自動搜尋並下載，或指定單一 ID")]:
        sub = subs.add_parser(name, help=help_text)
        sub.add_argument("--profile", type=Path, default=Path(".tcool-browser"))
        sub.add_argument("--channel", choices=["chromium", "chrome"], default="chromium")
        sub.add_argument("--headless", action="store_true", help="背景模式（驗證可能不支援）")
        sub.add_argument("--interactive", action="store_true", help="開始前等待你完成登入／驗證")
        sub.add_argument("--timeout", type=int, default=60, help="每次請求上限秒數")
        if name != "login":
            sub.add_argument("--output", type=Path, default=Path("tcool-output"))
            sub.add_argument("--grade", type=int, choices=range(1, 13))
        if name in ("search", "download"):
            sub.add_argument("--subject")
            sub.add_argument("--semester", choices=["1", "2"], default="")
            sub.add_argument("--period", choices=["1", "2", "3", "4"], default="")
            sub.add_argument("--publisher", default="")
            sub.add_argument("--city", default="")
            sub.add_argument("--has-answer", choices=["any", "yes", "official"], default="any")
            sub.add_argument("--delay", type=float, default=5, help="請求間隔秒數，至少 3 秒")
            sub.add_argument("--max-pages", type=int, default=0, help="0 抓完所有頁；正數限制搜尋頁數")
        if name == "download":
            source = sub.add_mutually_exclusive_group()
            source.add_argument("--exam-id", type=int)
            source.add_argument("--from-csv", type=Path, help="可選的舊清單匯入，不需重新搜尋")
            sub.add_argument("--kind", choices=["q", "a", "both"], default="q")
            sub.add_argument("--limit", type=int, default=0, help="最多新下載檔數；預設 0=全部")
            sub.add_argument("--dry-run", action="store_true", help="搜尋並列出下載計畫，不取得 PDF")
            sub.add_argument("--manual", action="store_true", help="由一般瀏覽器下載後匯入 PDF；搭配 --from-csv 或 --exam-id")
    return p


def validate_args(p, args):
    if args.timeout < 1:
        p.error("--timeout 必須大於 0")
    if args.headless and (args.interactive or args.command == "login"):
        p.error("--headless 不能與人工登入一起使用")
    if hasattr(args, "delay") and (not math.isfinite(args.delay) or args.delay < 3):
        p.error("--delay 必須是至少 3 秒的有限數字")
    if getattr(args, "max_pages", 0) < 0 or getattr(args, "limit", 0) < 0:
        p.error("--max-pages 與 --limit 不可為負數")
    direct = args.command == "download" and (args.exam_id is not None or args.from_csv is not None)
    if getattr(args, "manual", False):
        if not direct:
            p.error("--manual 需要 --from-csv 或 --exam-id")
        if args.headless:
            p.error("--manual 需要終端機人工輸入，不可搭配 --headless")
    if direct:
        if args.exam_id is not None and args.exam_id < 1:
            p.error("--exam-id 必須是正整數")
        if any([args.grade, args.subject, args.semester, args.period, args.publisher,
                args.city, args.has_answer != "any", args.max_pages]):
            p.error("指定 ID／CSV 時不可同時指定搜尋條件")
    elif args.command in ("search", "download") and (not args.grade or not args.subject):
        p.error("自動搜尋需要 --grade 與 --subject；其他篩選條件可省略")


def filters_for(args):
    return {"grade": str(args.grade), "subject": args.subject,
            "semester": args.semester, "period": args.period,
            "publisher": args.publisher, "city": args.city,
            "has_answer": {"any": "", "yes": "1", "official": "official"}[args.has_answer]}


def api(page, args, body):
    try:
        raw = request(page, args, "/api-exam.php", body, json_body=True)
    except Exception as exc:
        raise ValueError(f"API（{body.get('action')}）失敗：{exc}") from None
    try:
        payload = json.loads(raw)
    except ValueError:
        raise ValueError("API 回傳非 JSON，可能是 Cloudflare／登入頁") from None
    if not isinstance(payload, dict):
        raise ValueError("API 回應格式已改變")
    if payload.get("error") or payload.get("code"):
        raise ValueError(f"網站拒絕請求：{payload.get('code', '')} {payload.get('error', '')}")
    return payload


def crawl(page, args):
    filters = filters_for(args)
    rows, merged, ids, fingerprints = [], [], set(), set()
    number, last, complete = 1, 1, False
    write_catalog(args.output, rows, merged, filters, False, 0)
    while number <= last:
        if number > 1:
            time.sleep(args.delay)
        raw = request(page, args, "/", {**filters, "p": str(number)})
        result = parse_search(raw, number)
        signature = tuple(row["exam_id"] for row in result.rows)
        if signature and signature in fingerprints:
            raise ValueError(f"第 {number} 頁重複先前結果；已保留部分清單，停止以避免無限翻頁")
        fingerprints.add(signature)
        for row in result.rows:
            if row["exam_id"] not in ids:
                ids.add(row["exam_id"])
                rows.append(row)
        for entry in result.merged:
            if entry not in merged:
                merged.append(entry)
        last = max(last, result.last_page)
        complete = number >= last
        write_catalog(args.output, rows, merged, filters, complete, number)
        print(f"搜尋 {number}/{last} 頁，累計 {len(rows)} 筆", file=sys.stderr, flush=True)
        if args.max_pages and number >= args.max_pages:
            break
        number += 1
    print(f"清單：{args.output / 'exams.csv'}；完整搜尋：{complete}", file=sys.stderr)
    return rows


def pdf_pages(data):
    if not data.startswith(b"%PDF-"):
        raise ValueError("檔案不是 PDF")
    count = len(PdfReader(io.BytesIO(data)).pages)
    if count < 1:
        raise ValueError("PDF 沒有頁面")
    return count


def plan_downloads(rows, args):
    pending = []
    for exam_id, kind in download_jobs(rows, args.kind):
        path = args.output / "pdf" / f"tcool_{exam_id}_{kind}.pdf"
        if path.exists():
            try:
                pdf_pages(path.read_bytes())
            except Exception:
                raise ValueError(f"既有檔案損壞，請先移走再重跑：{path}") from None
            print(f"略過：{path.name}", file=sys.stderr)
            continue
        pending.append((exam_id, kind, path))
    return pending[:args.limit] if args.limit else pending


def manual_pdf(exam_id, kind):
    label = "題目卷" if kind == "q" else "PDF 答案"
    print(f"請用平常的瀏覽器開啟 https://www.tcool.cc/，自行下載考卷 {exam_id} 的{label}。\n"
          "若一般瀏覽器也無法通過驗證，請停止並稍後重試。工具不會自動完成網站驗證。",
          file=sys.stderr)
    while True:
        raw = input(f"確認檔案是 {exam_id}/{kind} 後，貼上 PDF 完整路徑（q 停止）：").strip()
        if raw.lower() == "q":
            raise KeyboardInterrupt
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
            raw = raw[1:-1]
        try:
            data = Path(raw).expanduser().read_bytes()
            pdf_pages(data)
            return data
        except Exception as exc:
            print(f"無法匯入 PDF：{exc}；請重新輸入路徑，或輸入 q 停止。", file=sys.stderr)


def download(page, args, tasks):
    manifest = args.output / "downloads.jsonl"
    for index, (exam_id, kind, path) in enumerate(tasks):
        # Also pace the first request after a catalog crawl.
        if not args.manual:
            time.sleep(args.delay)
        print(f"下載 {index + 1}/{len(tasks)}：{exam_id}/{kind}", file=sys.stderr, flush=True)
        if args.manual:
            data = manual_pdf(exam_id, kind)
        else:
            try:
                payload = api(page, args, {"action": "download_url", "exam_id": exam_id, "kind": kind})
                url = payload.get("download_url")
                if not isinstance(url, str) or not url:
                    raise ValueError("API 沒有回傳 download_url")
                data = navigate_pdf(page, args, url)
                pdf_pages(data)
            except Exception as exc:
                if not args.interactive:
                    raise ValueError(f"PDF 下載失敗：{exc}；可用 --interactive 人工處理，或用 --manual 匯入手動下載的 PDF") from None
                print(f"自動下載／驗證未完成：{exc}\n改由一般瀏覽器手動下載並匯入；也可輸入 q 停止。", file=sys.stderr)
                data = manual_pdf(exam_id, kind)
        pages = pdf_pages(data)
        atomic_write(path, data)
        record = {"exam_id": exam_id, "kind": kind, "file": str(path),
                  "pages": pages, "bytes": len(data),
                  "sha256": hashlib.sha256(data).hexdigest()}
        with manifest.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        print(json.dumps(record, ensure_ascii=False), flush=True)


def run(args):
    direct_rows = None
    if args.command == "download":
        if args.exam_id is not None:
            direct_rows = [{"exam_id": args.exam_id}]
        elif args.from_csv:
            direct_rows = import_csv(args.from_csv)
        if direct_rows is not None:
            tasks = plan_downloads(direct_rows, args)
            if args.dry_run or not tasks:
                print(json.dumps([{"exam_id": e, "kind": k, "file": str(p)} for e,k,p in tasks], ensure_ascii=False, indent=2))
                return
            if args.manual:
                download(None, args, tasks)
                return
    with session(args) as page:
        if args.command == "login":
            print(f"工作階段已保存：{args.profile.resolve()}（此訊息不代表已登入帳號）")
        elif args.command == "options":
            body = {"action": "filter_options"}
            if args.grade:
                body["grade"] = args.grade
            payload = api(page, args, body)
            options = payload.get("filterOptions")
            if not isinstance(options, dict):
                raise ValueError("API 沒有回傳 filterOptions")
            data = json.dumps(options, ensure_ascii=False, indent=2)
            atomic_write(args.output / "options.json", data.encode())
            print(data)
        else:
            rows = direct_rows if direct_rows is not None else crawl(page, args)
            if args.command == "download":
                tasks = plan_downloads(rows, args)
                if args.dry_run:
                    print(json.dumps([{"exam_id": e, "kind": k, "file": str(p)} for e,k,p in tasks], ensure_ascii=False, indent=2))
                else:
                    download(page, args, tasks)


def main(argv=None):
    p = parser()
    args = p.parse_args(argv)
    validate_args(p, args)
    try:
        run(args)
        return 0
    except (KeyboardInterrupt, EOFError):
        print("已停止；已完成檔案保留，下次會略過。", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"錯誤：{exc}\n已完成檔案保留。首頁登入不代表下載入口已通過驗證；若下載持續受阻，可用 download --from-csv <清單路徑> --manual 匯入手動下載的 PDF。", file=sys.stderr)
        return 1
