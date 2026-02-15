import os
import uuid
import logging
import base64

import boto3
from botocore.config import Config

logger = logging.getLogger(__name__)

s3_client = None


def get_s3_client():
    global s3_client
    if s3_client is None:
        s3_client = boto3.client(
            "s3",
            endpoint_url=os.getenv("IDRIVE_E2_ENDPOINT"),
            aws_access_key_id=os.getenv("IDRIVE_E2_ACCESS_KEY"),
            aws_secret_access_key=os.getenv("IDRIVE_E2_SECRET_KEY"),
            region_name="us-east-1",
            config=Config(signature_version="s3v4"),
        )
    return s3_client


def get_bucket():
    return os.getenv("IDRIVE_E2_BUCKET", "automateflow-files")


def upload_screenshot(screenshot_bytes, job_id: str) -> str:
    client = get_s3_client()
    bucket = get_bucket()
    key = f"screenshots/{job_id}/{uuid.uuid4()}.png"

    if isinstance(screenshot_bytes, str):
        try:
            screenshot_bytes = base64.b64decode(screenshot_bytes)
        except Exception:
            screenshot_bytes = screenshot_bytes.encode('utf-8')
    elif isinstance(screenshot_bytes, bytes) and not screenshot_bytes[:4] == b'\x89PNG':
        try:
            decoded = base64.b64decode(screenshot_bytes)
            if decoded[:4] == b'\x89PNG':
                screenshot_bytes = decoded
        except Exception:
            pass

    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=screenshot_bytes,
        ContentType="image/png",
        ACL="public-read",
    )

    endpoint = os.getenv("IDRIVE_E2_ENDPOINT", "")
    url = f"{endpoint}/{bucket}/{key}"
    logger.info(f"Uploaded screenshot: {url}")
    return url


def upload_file(file_bytes: bytes, job_id: str, filename: str, content_type: str = "application/octet-stream") -> str:
    client = get_s3_client()
    bucket = get_bucket()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    key = f"results/{job_id}/{uuid.uuid4()}.{ext}"

    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
        ACL="public-read",
    )

    endpoint = os.getenv("IDRIVE_E2_ENDPOINT", "")
    url = f"{endpoint}/{bucket}/{key}"
    logger.info(f"Uploaded file: {url}")
    return url
