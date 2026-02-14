import asyncio
import json
import os
import time
import logging
import signal
import sys

from dotenv import load_dotenv

load_dotenv()

from .utils.logger import setup_logging

setup_logging()

logger = logging.getLogger(__name__)

import redis
import httpx

from .browser_manager import browser_manager
from .llm_router import llm_router
from .handoff import check_for_handoff
from .utils.anti_detection import apply_stealth
from .session_manager import save_session

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
WORKER_SECRET = os.getenv("WORKER_SECRET", "")
QUEUE_NAME = "automation-jobs"

TEMPLATE_MAP = {
    "linkedin_scraper": "templates.linkedin_scraper",
    "price_monitor": "templates.price_monitor",
    "form_filler": "templates.form_filler",
    "screenshot_generator": "templates.screenshot_generator",
    "pdf_invoice_downloader": "templates.pdf_invoice_downloader",
}

shutdown_event = asyncio.Event()


def handle_signal(sig, frame):
    logger.info(f"Received signal {sig}, shutting down...")
    shutdown_event.set()


signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


async def send_callback(job_id: str, **kwargs):
    payload = {"jobId": job_id, **kwargs}
    headers = {
        "Content-Type": "application/json",
        "X-Worker-Secret": WORKER_SECRET,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{BACKEND_URL}/api/webhooks/worker",
                json=payload,
                headers=headers,
            )
            if resp.status_code != 200:
                logger.warning(f"Callback failed for job {job_id}: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"Callback error for job {job_id}: {e}")


async def process_job(job_data: dict):
    job_id = job_data.get("jobId")
    template_slug = job_data.get("templateSlug")
    task_description = job_data.get("taskDescription")
    parameters = job_data.get("parameters", {})

    logger.info(f"Processing job {job_id} (template: {template_slug})")

    start_time = time.time()

    async def callback_fn(**kwargs):
        await send_callback(job_id, **kwargs)

    await send_callback(job_id, status="processing", logs=["Job started"])

    try:
        if template_slug and template_slug in TEMPLATE_MAP:
            module_path = TEMPLATE_MAP[template_slug]
            module = __import__(f"src.{module_path}", fromlist=["run"])
            result = await module.run(parameters, job_id, callback_fn)
        elif task_description:
            result = await run_custom_task(task_description, parameters, job_id, callback_fn)
        else:
            raise ValueError("No template or task description provided")

        execution_time = int((time.time() - start_time) * 1000)
        await send_callback(
            job_id,
            status="completed",
            result=result,
            executionTime=execution_time,
            logs=["Job completed successfully"],
        )
        logger.info(f"Job {job_id} completed in {execution_time}ms")

    except Exception as e:
        execution_time = int((time.time() - start_time) * 1000)
        logger.error(f"Job {job_id} failed: {e}")
        await send_callback(
            job_id,
            status="failed",
            error=str(e),
            executionTime=execution_time,
            logs=[f"Job failed: {str(e)}"],
        )


async def run_custom_task(task_description: str, parameters: dict, job_id: str, callback_fn) -> dict:
    context = await browser_manager.create_context(job_id)
    page = await context.new_page()
    await apply_stealth(page)

    screenshot_task = await browser_manager.run_with_screenshots(
        page, job_id, callback_fn, interval=3.0
    )

    try:
        await callback_fn(logs=["Starting custom task execution..."])

        planning_prompt = f"""You are a browser automation agent. The user wants you to perform this task:

Task: {task_description}

Parameters: {json.dumps(parameters)}

Break this down into a list of browser actions. Each action should be one of:
- goto: Navigate to a URL
- click: Click an element (provide CSS selector)
- type: Type text into an element (provide CSS selector and text)
- wait: Wait for a specific time
- extract: Extract data from the page

Return a JSON array of action objects like:
[
  {{"action": "goto", "url": "https://example.com"}},
  {{"action": "click", "selector": "#button"}},
  {{"action": "type", "selector": "#input", "text": "hello"}},
  {{"action": "wait", "seconds": 2}},
  {{"action": "extract", "selector": "#result", "field": "text"}}
]

Only return the JSON array, no other text."""

        plan_text = await llm_router.generate(planning_prompt)

        try:
            start = plan_text.find("[")
            end = plan_text.rfind("]") + 1
            if start >= 0 and end > start:
                actions = json.loads(plan_text[start:end])
            else:
                actions = [{"action": "goto", "url": task_description}]
        except json.JSONDecodeError:
            actions = [{"action": "goto", "url": "https://www.google.com"}]

        await callback_fn(logs=[f"Plan created with {len(actions)} steps"])
        results = {}

        for i, action in enumerate(actions):
            action_type = action.get("action", "")
            await callback_fn(logs=[f"Step {i + 1}/{len(actions)}: {action_type}"])

            handoff_reason = await check_for_handoff(page)
            if handoff_reason:
                await callback_fn(
                    logs=[f"Handoff required: {handoff_reason}"],
                    handoff={"reason": handoff_reason},
                )
                await asyncio.sleep(300)

            try:
                if action_type == "goto":
                    url = action.get("url", "")
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(2)

                elif action_type == "click":
                    selector = action.get("selector", "")
                    await page.click(selector, timeout=10000)
                    await asyncio.sleep(1)

                elif action_type == "type":
                    selector = action.get("selector", "")
                    text = action.get("text", "")
                    await page.fill(selector, text)
                    await asyncio.sleep(0.5)

                elif action_type == "wait":
                    seconds = action.get("seconds", 2)
                    await asyncio.sleep(min(seconds, 30))

                elif action_type == "extract":
                    selector = action.get("selector", "body")
                    field = action.get("field", "text")
                    try:
                        element = await page.query_selector(selector)
                        if element:
                            if field == "text":
                                value = await element.inner_text()
                            elif field == "html":
                                value = await element.inner_html()
                            else:
                                value = await element.get_attribute(field)
                            results[f"step_{i + 1}"] = value
                    except Exception as e:
                        results[f"step_{i + 1}_error"] = str(e)

                elif action_type == "press":
                    key = action.get("key", "Enter")
                    await page.keyboard.press(key)
                    await asyncio.sleep(0.5)

            except Exception as e:
                await callback_fn(logs=[f"Step {i + 1} error: {str(e)}"])
                logger.warning(f"Action {action_type} failed: {e}")

        await save_session(context, job_id)
        await callback_fn(logs=["Custom task completed"])

        if not results:
            page_text = await page.inner_text("body")
            results["pageText"] = page_text[:5000]

        return results

    finally:
        screenshot_task.cancel()
        try:
            await screenshot_task
        except asyncio.CancelledError:
            pass
        await context.close()


async def main():
    logger.info("AutomateFlow Worker starting...")
    logger.info(f"Redis: {REDIS_URL}")
    logger.info(f"Backend: {BACKEND_URL}")

    await browser_manager.start()

    redis_client = redis.from_url(REDIS_URL)

    logger.info(f"Listening on queue: bull:{QUEUE_NAME}:wait")

    try:
        while not shutdown_event.is_set():
            try:
                result = redis_client.brpoplpush(
                    f"bull:{QUEUE_NAME}:wait",
                    f"bull:{QUEUE_NAME}:active",
                    timeout=5,
                )

                if result is None:
                    continue

                job_redis_id = result.decode("utf-8") if isinstance(result, bytes) else result
                job_key = f"bull:{QUEUE_NAME}:{job_redis_id}"
                job_raw = redis_client.hget(job_key, "data")

                if not job_raw:
                    logger.warning(f"No data found for job key: {job_key}")
                    continue

                job_data = json.loads(job_raw)
                logger.info(f"Dequeued job: {job_data.get('jobId', 'unknown')}")

                await process_job(job_data)

                redis_client.lrem(f"bull:{QUEUE_NAME}:active", 1, job_redis_id)

            except redis.ConnectionError as e:
                logger.error(f"Redis connection error: {e}")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                await asyncio.sleep(1)

    finally:
        await browser_manager.stop()
        redis_client.close()
        logger.info("Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
