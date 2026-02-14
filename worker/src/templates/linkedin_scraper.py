import asyncio
import logging
from typing import Dict, Any

from ..browser_manager import browser_manager
from ..utils.anti_detection import apply_stealth
from ..llm_router import llm_router
from ..session_manager import save_session

logger = logging.getLogger(__name__)


async def run(parameters: Dict[str, Any], job_id: str, callback_fn) -> Dict[str, Any]:
    profile_url = parameters.get("profileUrl")
    if not profile_url:
        raise ValueError("profileUrl is required")

    context = await browser_manager.create_context(job_id)
    page = await context.new_page()
    await apply_stealth(page)

    screenshot_task = await browser_manager.run_with_screenshots(
        page, job_id, callback_fn, interval=3.0
    )

    try:
        await callback_fn(logs=["Navigating to LinkedIn profile..."])
        await page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        await callback_fn(logs=["Extracting profile data..."])

        page_content = await page.content()
        screenshot_b64 = await browser_manager.take_screenshot_base64(page)

        prompt = f"""Extract the following information from this LinkedIn profile page HTML.
Return a valid JSON object with these fields:
- name: string
- headline: string
- location: string (if available)
- experience: array of objects with "title", "company", "duration"
- education: array of objects with "school", "degree", "field"
- about: string (summary/about section)

If a field is not found, use null or empty array.
Only return the JSON, no other text.

HTML content (first 5000 chars):
{page_content[:5000]}"""

        result_text = await llm_router.generate(prompt, image_base64=screenshot_b64, require_vision=True)

        import json
        try:
            start = result_text.find("{")
            end = result_text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(result_text[start:end])
            else:
                result = {"raw_text": result_text}
        except json.JSONDecodeError:
            result = {"raw_text": result_text}

        await save_session(context, job_id)
        await callback_fn(logs=["Profile data extracted successfully"])

        return result

    finally:
        screenshot_task.cancel()
        try:
            await screenshot_task
        except asyncio.CancelledError:
            pass
        await context.close()
