# Python Async/Await

## Basic Async Patterns

```python
import asyncio
from typing import List

# ✅ Async function definition
async def fetch_user(user_id: int) -> User:
    async with aiohttp.ClientSession() as session:
        async with session.get(f"/users/{user_id}") as response:
            data = await response.json()
            return User(**data)

# ✅ Running async code
async def main():
    user = await fetch_user(1)
    print(user.name)

asyncio.run(main())
```

## Parallel Execution

```python
# ❌ Sequential (slow)
async def get_all_users(ids: List[int]) -> List[User]:
    users = []
    for user_id in ids:
        user = await fetch_user(user_id)  # One at a time
        users.append(user)
    return users

# ✅ Parallel with gather (fast)
async def get_all_users(ids: List[int]) -> List[User]:
    tasks = [fetch_user(user_id) for user_id in ids]
    return await asyncio.gather(*tasks)  # All at once

# ✅ Parallel with error handling
async def get_all_users_safe(ids: List[int]) -> List[User | Exception]:
    tasks = [fetch_user(user_id) for user_id in ids]
    return await asyncio.gather(*tasks, return_exceptions=True)
```

## Async Context Managers

```python
from contextlib import asynccontextmanager

# ✅ Async context manager
@asynccontextmanager
async def get_connection():
    conn = await database.connect()
    try:
        yield conn
    finally:
        await conn.close()

# Usage
async def query_users():
    async with get_connection() as conn:
        return await conn.execute("SELECT * FROM users")
```

## Timeouts and Cancellation

```python
# ✅ Add timeouts to prevent hanging
async def fetch_with_timeout(url: str, timeout: float = 10.0):
    try:
        async with asyncio.timeout(timeout):
            return await fetch(url)
    except asyncio.TimeoutError:
        raise ServiceError(f"Request to {url} timed out")

# ✅ Handle cancellation gracefully
async def long_running_task():
    try:
        while True:
            await process_batch()
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        await cleanup()
        raise
```

## Semaphore for Rate Limiting

```python
# ✅ Limit concurrent operations
async def fetch_all(urls: List[str], max_concurrent: int = 10):
    semaphore = asyncio.Semaphore(max_concurrent)

    async def fetch_one(url: str):
        async with semaphore:
            return await fetch(url)

    return await asyncio.gather(*[fetch_one(url) for url in urls])
```
