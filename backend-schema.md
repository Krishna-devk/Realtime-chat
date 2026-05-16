```markdown
# Database Schema & Data Dictionary Spec (schema.md)

## Document Control
* **Project Name:** Real-Time Web Chat Core Engine Database Design
* **Target DBMS:** MySQL (v16.0+)
* **Architecture Style:** Relational with Composite B-Tree Indexing

---

## 1. Entity-Relationship Summary

The schema uses an optimized relational structure to handle user identity, conversation scopes, room memberships, and sequential real-time message streams. 

*   `users` to `chat_rooms` is a **Many-to-Many** relationship, resolved natively through the `room_members` join table.
*   `chat_rooms` to `messages` is a **One-to-Many** relationship. Every message must explicitly map to a single active room context.
*   `users` to `messages` is a **One-to-Many** relationship tracking message authorship (`sender_id`).

---

## 2. Table Specifications & Data Dictionaries

### 2.1 Table: `users`
Stores user profile information, authentication credentials, and account creation metadata.

| Column Name | Data Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Unique internal identifier for the user. |
| `username` | `VARCHAR(50)` | `UNIQUE`, `NOT NULL` | *None* | Unique display name used for authentication login. |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | *None* | Argon2id or bcrypt cryptographic password verification hash. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `CURRENT_TIMESTAMP` | Epoch timestamp reflecting account creation date. |

### 2.2 Table: `chat_rooms`
Defines the boundary of conversations. Supports both Direct Messages (1-on-1) and Group Channels.

| Column Name | Data Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Unique identifier for the conversation channel. |
| `name` | `VARCHAR(100)` | `NULL` | `NULL` | Display title of the room. Kept `NULL` for standard 1-on-1 DMs. |
| `is_group` | `BOOLEAN` | `NOT NULL` | `FALSE` | Boolean flag. `TRUE` for multi-user channels; `FALSE` for 1-on-1 DMs. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `CURRENT_TIMESTAMP` | Explicit timestamp recording room initialization. |

### 2.3 Table: `room_members`
A relational bridge table managing user distribution across rooms. Implements strict cascading hooks to ensure clean teardowns on member evictions.

| Column Name | Data Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `room_id` | `UUID` | `FOREIGN KEY`, `NOT NULL` | *None* | References `chat_rooms(id)` on cascade deletion pathways. |
| `user_id` | `UUID` | `FOREIGN KEY`, `NOT NULL` | *None* | References `users(id)` on cascade deletion pathways. |
| `joined_at` | `TIMESTAMPTZ` | `NOT NULL` | `CURRENT_TIMESTAMP` | Precise tracking marker for history view boundary filtering. |

* **Composite Primary Key Constraint:** `PRIMARY KEY (room_id, user_id)`

### 2.4 Table: `messages`
The high-throughput core ledger table storing text payloads and processing states. 

| Column Name | Data Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Server-assigned definitive message ID. |
| `client_msg_id` | `UUID` | `UNIQUE`, `NOT NULL` | *None* | Optimistic tracing ID generated client-side to prevent duplicates. |
| `room_id` | `UUID` | `FOREIGN KEY`, `NOT NULL` | *None* | References target `chat_rooms(id)` with cascading deletion. |
| `sender_id` | `UUID` | `FOREIGN KEY`, `NOT NULL` | *None* | References author `users(id)` with cascading deletion. |
| `content` | `TEXT` | `NOT NULL` | *None* | Raw structural textual contents of the message frame. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `CURRENT_TIMESTAMP` | Database commit timestamp utilized as pagination cursor index. |

---

## 3. Data Integrity & Constraints (DDL Script)

```sql
-- Enable standard UUID generator extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Initialize Identity Layer
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Initialize Scope Layer
CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) DEFAULT NULL,
    is_group BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Initialize Join Bridge Map
CREATE TABLE room_members (
    room_id UUID NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id),
    CONSTRAINT fk_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Initialize Core Messaging Storage Ledger
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_msg_id UUID UNIQUE NOT NULL,
    room_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

```

---

## 4. Index Optimization Matrix (High Throughput Architecture)

To ensure lookups do not slow down under heavy write loads or large row counts, you must explicitly construct these composite indexes.

```sql
-- 1. Optimizes infinite-scroll pagination sorting inside active rooms
-- Without this, fetching older messages triggers an O(N) database-wide table scan.
CREATE INDEX idx_messages_room_pagination 
ON messages (room_id, created_at DESC);

-- 2. Speed up sidebar layout lookups (list rooms a specific user belongs to)
CREATE INDEX idx_room_members_user 
ON room_members (user_id);

-- 3. Prevent lookups from bypassing structural uniqueness blocks during optimistic mutations
CREATE UNIQUE INDEX idx_messages_client_lookup 
ON messages (client_msg_id);

```

---

## 5. Performance Strategy Notes

1. **Strict Purge Policy:** Deleting a chat room triggers database cascade constraints (`ON DELETE CASCADE`) to instantly wipe tracking memberships and messages out-of-band.
2. **Immutability Rule:** The `messages` schema omits an `updated_at` parameter. Real-time chat tracking performs significantly better when records are treated as write-only, append-only logs. Message modification features should be deferred or managed through separate audit tables in later phases.
3. **Timestamp Standardization:** All schema parameters utilize `TIMESTAMPTZ` (Time with Time Zone). This forces MySQL to normalize timestamps internally to UTC coordinates, preventing timezone sync alignment anomalies between your FastAPI server workers and frontend browser runtimes.

```

```