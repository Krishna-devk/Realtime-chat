import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

async def create_db_if_not_exists():
    full_url = os.getenv("DATABASE_URL")
    if not full_url:
        print("DATABASE_URL not found in .env")
        return

    # Connect to 'test' or no database first
    # TiDB Cloud often allows connecting to 'test' or no DB
    base_url = full_url.rsplit('/', 1)[0]
    db_name = full_url.rsplit('/', 1)[1]
    
    # Try connecting without a database name
    target_url = f"{base_url}/"
    
    print(f"Connecting to {target_url} to create database '{db_name}'...")
    
    try:
        engine = create_async_engine(target_url, connect_args={"ssl": True})
        async with engine.connect() as conn:
            await conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {db_name}"))
            await conn.commit()
            print(f"Success! Database '{db_name}' created or already exists.")
        await engine.dispose()
    except Exception as e:
        print(f"Failed to create database: {e}")
        print("\nTIP: If this fails, please create the database 'chatdb' manually in your TiDB Cloud console.")

if __name__ == "__main__":
    asyncio.run(create_db_if_not_exists())
