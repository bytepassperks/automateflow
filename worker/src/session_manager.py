import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SESSIONS_DIR = "/tmp/automateflow_sessions"


def ensure_sessions_dir():
    os.makedirs(SESSIONS_DIR, exist_ok=True)


def get_session_path(job_id: str) -> str:
    ensure_sessions_dir()
    return os.path.join(SESSIONS_DIR, f"{job_id}_cookies.json")


async def save_session(context, job_id: str):
    try:
        cookies = await context.cookies()
        session_path = get_session_path(job_id)
        with open(session_path, "w") as f:
            json.dump(cookies, f)
        logger.info(f"Saved session for job {job_id}: {len(cookies)} cookies")
    except Exception as e:
        logger.warning(f"Failed to save session for job {job_id}: {e}")


async def load_session(context, job_id: str) -> bool:
    session_path = get_session_path(job_id)
    if not os.path.exists(session_path):
        return False

    try:
        with open(session_path, "r") as f:
            cookies = json.load(f)
        await context.add_cookies(cookies)
        logger.info(f"Loaded session for job {job_id}: {len(cookies)} cookies")
        return True
    except Exception as e:
        logger.warning(f"Failed to load session for job {job_id}: {e}")
        return False


def clear_session(job_id: str):
    session_path = get_session_path(job_id)
    if os.path.exists(session_path):
        os.remove(session_path)
        logger.info(f"Cleared session for job {job_id}")
