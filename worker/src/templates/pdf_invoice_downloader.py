import asyncio
import logging
from typing import Dict, Any

from ..browser_manager import browser_manager
from ..utils.anti_detection import apply_stealth
from ..llm_router import llm_router
from ..session_manager import save_session
from ..utils.storage import upload_file

logger = logging.getLogger(__name__)


async def run(parameters: Dict[str, Any], job_id: str, callback_fn) -> Dict[str, Any]:
    portal_url = parameters.get("portalUrl")
    login_credentials = parameters.get("loginCredentials", {})
    invoice_identifier = parameters.get("invoiceIdentifier")

    if not portal_url:
        raise ValueError("portalUrl is required")
    if not login_credentials:
        raise ValueError("loginCredentials is required")
    if not invoice_identifier:
        raise ValueError("invoiceIdentifier is required")

    username = login_credentials.get("username", "")
    password = login_credentials.get("password", "")

    context = await browser_manager.create_context(job_id)
    page = await context.new_page()
    await apply_stealth(page)

    screenshot_task = await browser_manager.run_with_screenshots(
        page, job_id, callback_fn, interval=3.0
    )

    try:
        await callback_fn(logs=["Navigating to portal..."])
        await page.goto(portal_url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)

        await callback_fn(logs=["Attempting login..."])

        login_selectors = {
            "username": [
                'input[type="email"]',
                'input[type="text"][name*="user"]',
                'input[name="username"]',
                'input[name="email"]',
                'input[id="username"]',
                'input[id="email"]',
                'input[autocomplete="username"]',
            ],
            "password": [
                'input[type="password"]',
                'input[name="password"]',
                'input[id="password"]',
            ],
        }

        for selector in login_selectors["username"]:
            try:
                el = await page.query_selector(selector)
                if el and await el.is_visible():
                    await el.fill(username)
                    await callback_fn(logs=["Username entered"])
                    break
            except Exception:
                continue

        for selector in login_selectors["password"]:
            try:
                el = await page.query_selector(selector)
                if el and await el.is_visible():
                    await el.fill(password)
                    await callback_fn(logs=["Password entered"])
                    break
            except Exception:
                continue

        submit_selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Login")',
            'button:has-text("Sign in")',
            'button:has-text("Log in")',
        ]

        for selector in submit_selectors:
            try:
                btn = await page.query_selector(selector)
                if btn and await btn.is_visible():
                    await btn.click()
                    break
            except Exception:
                continue

        await asyncio.sleep(3)
        await save_session(context, job_id)
        await callback_fn(logs=["Login attempted, searching for invoice..."])

        page_content = await page.content()
        screenshot_b64 = await browser_manager.take_screenshot_base64(page)

        prompt = f"""I need to find and download an invoice with identifier "{invoice_identifier}" from this portal.
Looking at the page, describe the steps needed to navigate to the invoice download.
If there's a search field, provide the CSS selector.
If there are direct links to invoices, provide the link pattern.

Return a JSON with:
- "searchSelector": CSS selector for search input (or null)
- "invoiceLink": direct link to invoice if visible (or null)
- "nextSteps": description of what to do next

HTML (first 5000 chars):
{page_content[:5000]}"""

        result_text = await llm_router.generate(prompt, image_base64=screenshot_b64, require_vision=True)

        import json
        try:
            start = result_text.find("{")
            end = result_text.rfind("}") + 1
            if start >= 0 and end > start:
                nav_instructions = json.loads(result_text[start:end])
            else:
                nav_instructions = {}
        except json.JSONDecodeError:
            nav_instructions = {}

        search_selector = nav_instructions.get("searchSelector")
        if search_selector:
            try:
                search_el = await page.query_selector(search_selector)
                if search_el:
                    await search_el.fill(invoice_identifier)
                    await page.keyboard.press("Enter")
                    await asyncio.sleep(3)
                    await callback_fn(logs=[f"Searched for invoice: {invoice_identifier}"])
            except Exception as e:
                logger.warning(f"Search failed: {e}")

        pdf_url = None

        async with page.expect_download(timeout=15000) as download_info:
            try:
                download_triggers = [
                    f'a:has-text("{invoice_identifier}")',
                    'a[href*=".pdf"]',
                    'button:has-text("Download")',
                    'a:has-text("Download")',
                ]
                for selector in download_triggers:
                    try:
                        el = await page.query_selector(selector)
                        if el and await el.is_visible():
                            await el.click()
                            break
                    except Exception:
                        continue
            except Exception:
                pass

        try:
            download = await download_info.value
            file_path = await download.path()
            if file_path:
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
                pdf_url = upload_file(file_bytes, job_id, f"invoice_{invoice_identifier}.pdf", "application/pdf")
                await callback_fn(logs=[f"Invoice downloaded: {pdf_url}"])
        except Exception as e:
            logger.warning(f"Download handling failed: {e}")
            await callback_fn(logs=[f"Could not download PDF automatically: {e}"])

        return {
            "invoiceIdentifier": invoice_identifier,
            "pdfUrl": pdf_url,
            "portalUrl": portal_url,
            "success": pdf_url is not None,
        }

    finally:
        screenshot_task.cancel()
        try:
            await screenshot_task
        except asyncio.CancelledError:
            pass
        await context.close()
