from contextlib import contextmanager
from pathlib import Path
import sys
from urllib.parse import urljoin, urlsplit

from playwright.sync_api import sync_playwright

BASE = "https://www.tcool.cc"

# fetch is deliberately in the browser's same origin, with its own session.
# Challenge solving and site rate-limit recovery remain manual.
REQUEST = r"""async ({url, body, json, timeout}) => {
  const target = new URL(url, location.origin);
  if (target.origin !== location.origin) throw new Error('下載網址跨網域，請人工確認');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const options = {credentials: 'same-origin', signal: controller.signal};
    if (body !== null) {
      options.method = 'POST';
      options.headers = {'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded'};
      options.body = json ? JSON.stringify(body) : new URLSearchParams(body).toString();
    }
    const response = await fetch(target.href, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}：請在網站確認登入、驗證或用量限制`);
    return await response.text();
  } finally { clearTimeout(timer); }
}"""


@contextmanager
def session(args):
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            str(args.profile.resolve()), headless=args.headless,
            channel="chrome" if args.channel == "chrome" else None,
            accept_downloads=True,
        )
        try:
            page = context.pages[0] if context.pages else context.new_page()
            page.goto(BASE + "/", wait_until="domcontentloaded", timeout=args.timeout * 1000)
            if args.interactive or args.command == "login":
                input("請在瀏覽器確認首頁正常，必要時自行登入／完成驗證，再回此處按 Enter：")
            if urlsplit(page.url).netloc != "www.tcool.cc":
                raise ValueError("瀏覽器未回到 tcool，請先完成登入")
            # Missing form means this may be a challenge page, not a ready session.
            page.locator("#exam-filter-form").wait_for(state="attached", timeout=args.timeout * 1000)
            yield page
        finally:
            context.close()


def request(page, args, url, body=None, json_body=False):
    return page.evaluate(REQUEST, {"url": url, "body": body, "json": json_body,
                                  "timeout": args.timeout * 1000})


def navigate_pdf(page, args, url):
    """Save through the browser, rather than reading PDF viewer HTML."""
    target = urljoin(page.url, url)
    if (urlsplit(target).scheme, urlsplit(target).netloc) != (urlsplit(page.url).scheme, urlsplit(page.url).netloc):
        raise ValueError("下載網址跨網域，請人工確認")
    def read_download(item):
        failure = item.failure()
        if failure:
            detail = "canceled" if failure == "canceled" else "failed"
            raise ValueError(f"瀏覽器保存失敗：{detail}")
        return Path(item.path()).read_bytes()

    def save(address):
        with page.expect_download(timeout=args.timeout * 1000) as pending:
            page.evaluate("""url => {
              const a = document.createElement('a');
              a.href = url; a.download = 'exam.pdf';
              document.body.appendChild(a); a.click(); a.remove();
            }""", address)
        return read_download(pending.value)

    if not args.interactive:
        try:
            return save(target)
        except Exception as exc:
            # Playwright exception strings can contain the signed download URL.
            raise ValueError(f"原生保存未完成（{type(exc).__name__}）；可加 --interactive 在同一工作階段完成驗證") from None

    # Navigate first: a challenge must be displayed as a page, not downloaded.
    try:
        viewer = page.context.new_page()
    except Exception:
        raise ValueError("無法開啟下載分頁：瀏覽器工作階段已關閉或無法使用") from None
    downloads = []
    state = {"status": None, "pdf": False, "challenge": False}

    def observe(response):
        if not response.request.is_navigation_request() or response.frame != viewer.main_frame:
            return
        content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        state.update(status=response.status, pdf=content_type == "application/pdf",
                     challenge=response.headers.get("cf-mitigated") == "challenge")
        stage = "重新導向" if 300 <= response.status < 400 else "下載頁"
        kind = "PDF" if state["pdf"] else "非 PDF"
        verification = "；Cloudflare 要求驗證" if state["challenge"] else ""
        print(f"{stage}：HTTP {response.status}，{kind}{verification}", file=sys.stderr, flush=True)

    viewer.on("response", observe)
    viewer.on("download", lambda item: downloads.append(item))
    attempted_save = False
    try:
        try:
            viewer.goto(target, referer=page.url, wait_until="domcontentloaded", timeout=args.timeout * 1000)
        except Exception as exc:
            # An attachment interrupts goto but emits a download event.
            print(f"下載頁導航未正常結束（{type(exc).__name__}）；檢查下載事件與分頁狀態。", file=sys.stderr)
        while True:
            if viewer.is_closed():
                raise ValueError("下載分頁或瀏覽器已關閉；未保存 PDF")
            # Dispatch queued events after input() yielded control to the person.
            viewer.wait_for_timeout(100)
            if downloads:
                return read_download(downloads.pop(0))
            resolved = viewer.url
            if resolved != "about:blank" and (urlsplit(resolved).scheme, urlsplit(resolved).netloc) != (urlsplit(page.url).scheme, urlsplit(page.url).netloc):
                raise ValueError("下載分頁不在原網站，已停止")
            ready = not state["challenge"] and (state["status"] is None or state["status"] < 400) and (
                state["pdf"] or urlsplit(resolved).path.lower().endswith('.pdf'))
            if ready and not attempted_save:
                attempted_save = True
                try:
                    return save(resolved)
                except Exception as exc:
                    print(f"PDF 分頁已開啟，但原生保存未完成（{type(exc).__name__}）。可在同一分頁按 PDF 下載按鈕，再按 Enter。", file=sys.stderr)
            action = input("請在這個下載分頁完成驗證；看到 PDF／完成下載後按 Enter 檢查（q 停止；不要關閉瀏覽器）：")
            if action.strip().lower() == "q":
                raise KeyboardInterrupt
    finally:
        if not viewer.is_closed():
            viewer.close()
