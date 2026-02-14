import asyncio
import logging
from typing import Dict, Any

from ..browser_manager import browser_manager
from ..utils.anti_detection import apply_stealth
from ..llm_router import llm_router

logger = logging.getLogger(__name__)


async def run(parameters: Dict[str, Any], job_id: str, callback_fn) -> Dict[str, Any]:
    form_url = parameters.get("formUrl")
    field_values = parameters.get("fieldValues", {})
    should_submit = parameters.get("submit", False)

    if not form_url:
        raise ValueError("formUrl is required")
    if not field_values:
        raise ValueError("fieldValues is required")

    context = await browser_manager.create_context(job_id)
    page = await context.new_page()
    await apply_stealth(page)

    screenshot_task = await browser_manager.run_with_screenshots(
        page, job_id, callback_fn, interval=3.0
    )

    try:
        await callback_fn(logs=["Navigating to form page..."])
        await page.goto(form_url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)

        filled_fields = []
        failed_fields = []

        for field_name, field_value in field_values.items():
            await callback_fn(logs=[f"Filling field: {field_name}"])

            selectors = [
                f'input[name="{field_name}"]',
                f'textarea[name="{field_name}"]',
                f'select[name="{field_name}"]',
                f'input[id="{field_name}"]',
                f'textarea[id="{field_name}"]',
                f'input[placeholder*="{field_name}" i]',
                f'textarea[placeholder*="{field_name}" i]',
                f'input[aria-label*="{field_name}" i]',
            ]

            filled = False
            for selector in selectors:
                try:
                    element = await page.query_selector(selector)
                    if element:
                        is_visible = await element.is_visible()
                        if not is_visible:
                            continue

                        tag = await element.evaluate("el => el.tagName.toLowerCase()")
                        if tag == "select":
                            await element.select_option(value=str(field_value))
                        else:
                            await element.click()
                            await element.fill(str(field_value))

                        filled_fields.append(field_name)
                        filled = True
                        break
                except Exception as e:
                    logger.debug(f"Selector {selector} failed: {e}")
                    continue

            if not filled:
                try:
                    page_content = await page.content()
                    prompt = f"""Given this HTML form, find the CSS selector for the input field that corresponds to "{field_name}".
Return ONLY the CSS selector, nothing else.

HTML (first 3000 chars):
{page_content[:3000]}"""

                    selector = await llm_router.generate(prompt)
                    selector = selector.strip().strip('"').strip("'").strip("`")

                    element = await page.query_selector(selector)
                    if element:
                        await element.click()
                        await element.fill(str(field_value))
                        filled_fields.append(field_name)
                        filled = True
                except Exception as e:
                    logger.warning(f"LLM-assisted fill failed for {field_name}: {e}")

            if not filled:
                failed_fields.append(field_name)
                await callback_fn(logs=[f"Could not find field: {field_name}"])

            await asyncio.sleep(0.5)

        if should_submit:
            await callback_fn(logs=["Submitting form..."])
            submit_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Submit")',
                'button:has-text("Send")',
                'button:has-text("Save")',
            ]

            submitted = False
            for selector in submit_selectors:
                try:
                    btn = await page.query_selector(selector)
                    if btn:
                        await btn.click()
                        submitted = True
                        await asyncio.sleep(2)
                        break
                except Exception:
                    continue

            if not submitted:
                await callback_fn(logs=["Could not find submit button"])

        await callback_fn(logs=[f"Form filling complete. Filled: {len(filled_fields)}, Failed: {len(failed_fields)}"])

        return {
            "filledFields": filled_fields,
            "failedFields": failed_fields,
            "submitted": should_submit,
            "url": form_url,
        }

    finally:
        screenshot_task.cancel()
        try:
            await screenshot_task
        except asyncio.CancelledError:
            pass
        await context.close()
