import asyncio
import json
import os
import time
import logging
import signal
import base64

from dotenv import load_dotenv

load_dotenv()

from .utils.logger import setup_logging

setup_logging()

logger = logging.getLogger(__name__)

import redis
import httpx

from .llm_router import create_llm, create_fallback_llm
from .utils.storage import upload_screenshot

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
            result = await run_browser_use_task(task_description, parameters, job_id, callback_fn)
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


async def run_browser_use_task(task_description: str, parameters: dict, job_id: str, callback_fn) -> dict:
    from browser_use import Agent, Browser

    await callback_fn(logs=["Starting browser-use agent..."])

    llm = create_llm()
    fallback = create_fallback_llm()

    browser = Browser(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--window-size=1920,1080",
        ],
    )

    step_count = [0]

    async def on_step_end(agent_instance):
        step_count[0] += 1
        step_num = step_count[0]

        thought = ""
        if hasattr(agent_instance.state, 'last_thought') and agent_instance.state.last_thought:
            thought = agent_instance.state.last_thought[:200]

        actions = agent_instance.history.model_actions()
        action_desc = ""
        if actions and len(actions) > 0:
            last_actions = actions[-1] if actions else []
            for act in last_actions:
                action_desc += f" {type(act).__name__}"

        log_msg = f"Step {step_num}"
        if thought:
            log_msg += f": {thought}"
        if action_desc:
            log_msg += f" | Actions:{action_desc}"
        await callback_fn(logs=[log_msg])

        try:
            page = await agent_instance.browser_session.get_current_page()
            if page:
                screenshot_bytes = await page.screenshot()
                url = upload_screenshot(screenshot_bytes, job_id)
                if url:
                    await callback_fn(screenshots=[url])
        except Exception as e:
            logger.warning(f"Screenshot in hook failed: {e}")

    task = task_description
    if parameters:
        param_str = json.dumps(parameters, indent=2)
        task = f"{task_description}\n\nAdditional parameters:\n{param_str}"

    agent = Agent(
        task=task,
        llm=llm,
        fallback_llm=fallback,
        browser=browser,
        use_vision=True,
        max_failures=3,
        max_actions_per_step=4,
    )

    await callback_fn(logs=["Browser-use agent initialized with vision, executing task..."])

    try:
        history = await agent.run(
            max_steps=30,
            on_step_end=on_step_end,
        )

        extracted = history.extracted_content()
        final_url = history.urls()[-1] if history.urls() else ""

        try:
            screenshot_bytes = await agent.browser_session.take_screenshot()
            if screenshot_bytes:
                url = upload_screenshot(screenshot_bytes, job_id)
                if url:
                    await callback_fn(screenshots=[url])
        except Exception as e:
            logger.warning(f"Final screenshot failed: {e}")

        await callback_fn(logs=["Browser-use agent completed task"])

        result_data = {
            "extracted_content": extracted if extracted else [],
            "final_url": final_url,
            "steps_taken": step_count[0],
        }

        thoughts = history.model_thoughts()
        if thoughts:
            result_data["agent_thoughts"] = [str(t)[:500] for t in thoughts[-3:]]

        return result_data

    finally:
        try:
            await browser.close()
        except Exception:
            pass


async def main():
    logger.info("AutomateFlow Worker starting (browser-use powered)...")
    logger.info(f"Redis: {REDIS_URL}")
    logger.info(f"Backend: {BACKEND_URL}")

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
        redis_client.close()
        logger.info("Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
