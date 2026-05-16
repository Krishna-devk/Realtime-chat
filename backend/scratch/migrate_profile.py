import os
import pymysql
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load .env from the parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")

def run_migration():
    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL not found in .env")
        return

    # Parse the DATABASE_URL manually to use with pymysql (sync)
    # Expected format: mysql+aiomysql://user:pass@host:port/db
    try:
        # Strip the +aiomysql or +pymysql if present
        clean_url = DATABASE_URL.replace("mysql+aiomysql://", "mysql://").replace("mysql+pymysql://", "mysql://")
        result = urlparse(clean_url)
        
        username = result.username
        password = result.password
        host = result.hostname
        port = result.port or 3306
        database = result.path.lstrip('/')

        print(f"🔗 Connecting to {host}:{port} via Sync Driver...")
        
        # Connect using standard pymysql with SSL
        connection = pymysql.connect(
            host=host,
            user=username,
            password=password,
            database=database,
            port=port,
            ssl={'ssl': True}, # Basic SSL for TiDB Cloud
            connect_timeout=10
        )

        with connection.cursor() as cursor:
            print("✅ Connection established.")
            
            print("📝 Checking table columns...")
            cursor.execute("SHOW COLUMNS FROM users")
            existing_columns = [row[0] for row in cursor.fetchall()]
            
            changes_made = False
            
            if 'display_name' not in existing_columns:
                print("➕ Adding 'display_name'...")
                cursor.execute("ALTER TABLE users ADD COLUMN display_name VARCHAR(100);")
                changes_made = True
            
            if 'bio' not in existing_columns:
                print("➕ Adding 'bio'...")
                cursor.execute("ALTER TABLE users ADD COLUMN bio VARCHAR(255);")
                changes_made = True
            
            if 'avatar_url' not in existing_columns:
                print("➕ Adding 'avatar_url'...")
                cursor.execute("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255);")
                changes_made = True

            if changes_made:
                connection.commit()
                print("\n✨ Migration successful! Columns added.")
            else:
                print("\n👌 Table is already up to date.")
            
            print("🚀 You can now restart your backend: fastapi dev main.py")

    except Exception as e:
        print(f"\n❌ Migration failed!")
        print(f"Error details: {str(e)}")
        print("\n💡 TIP: If this still fails, please check your TiDB Cloud IP Whitelist.")
        print("TiDB blocks all connections by default unless your IP is added or 'Allow All' (0.0.0.0/0) is enabled.")
    finally:
        if 'connection' in locals() and connection.open:
            connection.close()

if __name__ == "__main__":
    run_migration()
