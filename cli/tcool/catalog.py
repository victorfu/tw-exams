import csv
import io
import json
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

BASE = "https://www.tcool.cc"
FIELDS = ["exam_id", "school", "city", "grade_subject", "year_period",
          "publisher", "answer", "mock", "ai", "page", "has_question"]


@dataclass
class SearchPage:
    rows: list
    merged: list
    last_page: int


def parse_search(html, page):
    soup = BeautifulSoup(html, "html.parser")
    container = soup.select_one("#results-container")
    if container is None:
        raise ValueError("回應不是搜尋結果頁：可能需要登入／驗證，或網站結構改變")
    rows = []
    for item in container.select(".result"):
        def text(selector):
            element = item.select_one(selector)
            return element.get_text(" ", strip=True) if element else ""

        def href(selector):
            element = item.select_one(selector)
            return element.get("href", "") if element else ""

        question = item.select_one('[data-download-kind="q"]')
        anchor = item.select_one("[data-exam-id]")
        identifier = str(anchor.get("data-exam-id", "")) if anchor else ""
        if not identifier:
            match = re.search(r"/(?:ai|mock)/(\d+)/", href(".ai a") or href(".mock a"))
            identifier = match.group(1) if match else ""
        if not re.fullmatch(r"[1-9]\d*", identifier):
            raise ValueError(f"第 {page} 頁出現無法解析的 exam_id；停止以避免漏資料")
        if not text(".school") or not text(".grade-subject"):
            raise ValueError(f"考卷 {identifier} 缺少必要欄位；網站結構可能改變")
        rows.append({
            "exam_id": int(identifier), "school": text(".school"),
            "city": text(".city"), "grade_subject": text(".grade-subject"),
            "year_period": text(".year-period"), "publisher": text(".publisher"),
            "answer": "pdf" if item.select_one('[data-download-kind="a"]') else
                      "ai" if item.select_one('.answer form[action="/answer.php"]') else "",
            "mock": href(".mock a"), "ai": href(".ai a"),
            "page": page, "has_question": question is not None,
        })
    buttons = soup.select("#pagination-container [onclick]")
    numbers = [int(m.group(1)) for b in buttons
               if (m := re.fullmatch(r"\s*gotoPage\((\d+)\);?\s*", b.get("onclick", "")))]
    last = max([page] + numbers)
    current = soup.select_one("#pagination-container .current")
    if current and current.get_text(strip=True).isdigit() and int(current.get_text(strip=True)) != page:
        raise ValueError(f"要求第 {page} 頁，但網站回傳第 {current.get_text(strip=True)} 頁")
    if not rows and last > 1:
        raise ValueError(f"第 {page} 頁無資料，但分頁仍存在；停止以避免不完整結果")
    merged = []
    for item in soup.select("#merged-container .result"):
        label = item.select_one(".col-start")
        def link(selector):
            a = item.select_one(selector)
            return urljoin(BASE, a["href"]) if a and a.get("href") else ""
        merged.append({"title": label.get_text(" ", strip=True) if label else "",
                       "mock": link(".mockButton"), "ai": link(".mergedButton")})
    return SearchPage(rows, merged, last)


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".part")
    temp.write_bytes(data)
    temp.replace(path)


def write_catalog(directory, rows, merged, filters, complete, pages):
    directory = Path(directory)
    document = {"filters": filters, "complete": complete, "pages_fetched": pages,
                "count": len(rows), "exams": rows, "merged": merged}
    atomic_write(directory / "exams.json", json.dumps(document, ensure_ascii=False, indent=2).encode())
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows({k: row.get(k, "") for k in FIELDS} for row in rows)
    atomic_write(directory / "exams.csv", stream.getvalue().encode("utf-8-sig"))


def import_csv(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if "exam_id" not in (reader.fieldnames or []):
            raise ValueError("CSV 缺少 exam_id 欄位")
        return list(reader)


def download_jobs(rows, kind):
    seen = set()
    for row in rows:
        identifier = str(row.get("exam_id", "")).strip()
        if not re.fullmatch(r"[1-9]\d*", identifier):
            raise ValueError(f"無效 exam_id：{identifier!r}")
        for part in (["q", "a"] if kind == "both" else [kind]):
            if part == "a" and "answer" in row and row["answer"].strip().lower() != "pdf":
                continue
            if part == "q" and str(row.get("has_question", True)).lower() in ("false", "0"):
                continue
            key = (int(identifier), part)
            if key not in seen:
                seen.add(key)
                yield key
