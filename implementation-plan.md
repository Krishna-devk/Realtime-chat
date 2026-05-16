```markdown
# Engineering Implementation Plan (implementation_plan.md)

## Document Control
* **Project Name:** Real-Time Web Chat Implementation Roadmap
* **System Version:** 1.0.0
* **Date:** May 16, 2026
* **Status:** Operational Blueprint

---

## 1. Phase-Based Execution Roadmap

This plan assumes a clean-slate development environment. Each phase serves as a structural gate; do not proceed to the next phase until the automated test criteria for the current phase are completely met.


```

┌──────────────────────────────┐
│  PHASE 1: Core Infra Setup   │ ──► Docker, Mys DDL, Redis Smoke Tests
└──────────────┬───────────────┘
▼
┌──────────────────────────────┐
│  PHASE 2: FastAPI Auth REST  │ ──► JWT HTTP-Only Cookies, Session Guards
└──────────────┬───────────────┘
▼
┌──────────────────────────────┐
│  PHASE 3: WS Engine & PubSub │ ──► Connection Managers, Redis Sync Engine
└──────────────┬───────────────┘
▼
┌──────────────────────────────┐
│  PHASE 4: React UI Setup     │ ──► Zustand Stores, Custom WS Hooks
└──────────────┬───────────────┘
▼
┌──────────────────────────────┐
│  PHASE 5: Integration & Opt  │ ──► Optimistic UI, Virtualization, Heartbeats
└──────────────────────────────┘

```

---

## 2. Milestone Breakdown & Technical Tasks

### Phase 1: Environment & Core Infrastructure Setup
**Objective:** Spin up isolated infrastructure primitives and verify baseline network connectivity.

*   **Task 1.1: Local Container Orchestration**
    *   Create a local `docker-compose.yml` defining MySQL 16 and Redis 7.2 instances.
    *   Expose MySQL on port `5432` and Redis on port `6379`. Set explicit access credentials via environmental variables.
*   **Task 1.2: Database Migration Baseline**
    *   Initialize a Python virtual environment. Install `SQLAlchemy`, `asyncpg`, and `alembic`.
    *   Execute the DDL schema script to establish the `users`, `chat_rooms`, `room_members`, and `messages` table layout.
    *   Verify the existence of composite performance indexes (`idx_messages_room_pagination`).

### Phase 2: FastAPI Authentication & Core REST Layer
**Objective:** Secure the platform and provide the foundational HTTP endpoints needed before a WebSocket connection can be initialized.

*   **Task 2.1: Identity Subsystem**
    *   Implement `/api/v1/auth/signup` and `/api/v1/auth/login` endpoints.
    *   Integrate `passlib` with the `bcrypt` or `argon2` backend for secure password hashing.
    *   Configure the login handler to issue an encrypted JWT, appended to the response header via an `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
*   **Task 2.2: Channel Information Retrieval**
    *   Expose `GET /api/v1/rooms` to pull all active channel metadata objects belonging to a requesting user id.
    *   Expose `GET /api/v1/messages?room_id={uuid}&cursor={timestamp}&limit=50` implementing the strict descending cursor-based pagination query.

### Phase 3: WebSocket Engine & Distributed Redis Pub/Sub
**Objective:** Build the bidirectional real-time communication pipeline.

*   **Task 3.1: Connection Topology Registry**
    *   Implement the asynchronous `ClusterConnectionManager` class to register and evict connected browsers based on composite `user_id:tab_id` structures.
    *   Expose the functional endpoint route entry at `@app.websocket("/ws/connect")`.
    *   Write a dependency wrapper to extract and validate the user session context directly from incoming HTTP protocol upgrade request headers.
*   **Task 3.2: Redis Inter-Process Communication Bridge**
    *   Integrate `redis-py` (formerly `aioredis`) into the FastAPI event loop startup hook.
    *   Write a dedicated background loop running continuously to listen to the Redis backend cluster channel (`chat_cluster_channel`).
    *   Configure the handler: when a packet drops into the local thread pool, instantly extract target IDs and push JSON text frames out to all matching web tabs registered locally.

### Phase 4: React JS Architecture & State Hydration
**Objective:** Build the core frontend architecture and establish the persistent streaming engine.

*   **Task 4.1: Structural UI Framework Placement**
    *   Scaffold the UI application framework utilizing Vite + TypeScript.
    *   Build out the locked layouts (Sidebar fixed at 35% viewport width, message feed canvas filling remaining space).
*   **Task 4.2: Global State Isolation Engine (Zustand)**
    *   Initialize a dedicated state file `useChatStore.ts`.
    *   Implement structural actions: `addMessage`, `setRoomHistory`, and `setOnlineStatus`. Ensure state modifications are purely atomic.
*   **Task 4.3: Custom Resiliency Hook (`useWebSocket`)**
    *   Write a structural React hook handling browser-native `new WebSocket()` configurations.
    *   Inject the exponential backoff automatic retry matrix loop directly into the `onclose` callback window.
    *   Bind the `onmessage` data handler directly to the Zustand store action mutations.

### Phase 5: Integration, Optimization & Hardening
**Objective:** Bridge the decoupled layers, optimize layout rendering, and prevent memory leaks.

*   **Task 5.1: Optimistic UI Pipeline Execution**
    *   Configure the frontend chat input box submit action to append text data fields instantly to the viewport array with an status flag hardcoded to `"pending"`.
    *   Configure the server inbound message handler to echo back an authorization ticket confirmation matching the `client_msg_id`. The client catches this and mutates the message status to `"sent"`.
*   **Task 5.2: DOM Virtualization Integration**
    *   Integrate a virtualization engine (e.g., `react-virtuoso`) within the active message feed workspace panel.
    *   Bind scroll boundary threshold flags to execute HTTP REST page requests whenever a user manually scrolls to the top edge boundary line.
*   **Task 5.3: Server-Enforced Heartbeat Guards**
    *   Write an internal ticker inside FastAPI to dispatch async ping frames down all active registered sockets every 30 seconds.
    *   Establish a 15-second response cut-off window. If a connection drops its pong responses, explicitly execute eviction protocols.

---

## 3. Verification & Testing Gate Matrix

Before promoting code checkpoints throughout deployment cycles, verification scripts must achieve clean confirmations across these explicit tests:


```

┌────────────────────────────────────────────────────────────────────────┐
│                        ENGINE BLOCK VALIDATION                         │
├───────────────────┬────────────────────────────────────────────────────┤
│ Test ID           │ Validation Focus                                   │
├───────────────────┼────────────────────────────────────────────────────┤
│ QA-1.1 (REST)     │ Assert Login sets HttpOnly Cookie header correctly │
├───────────────────┼────────────────────────────────────────────────────┤
│ QA-1.2 (WS-Auth)  │ Assert WebSocket rejects upgrade if cookie missing │
├───────────────────┼────────────────────────────────────────────────────┤
│ QA-1.3 (Multi-Tab)│ Assert message triggers rendering across 2 tabs    │
├───────────────────┼────────────────────────────────────────────────────┤
│ QA-1.4 (Backoff)  │ Kill backend node; verify client backoff curves    │
├───────────────────┼────────────────────────────────────────────────────┤
│ QA-1.5 (Leak)     │ Verify socket eviction counts after forced timeout │
└───────────────────┴────────────────────────────────────────────────────┘

```

---

## 4. Production Deployment Checklist

1.  **Transport Security Integration:** WSS (`wss://`) and HTTPS constraints must be enforced at the gateway layer. Standard unencrypted connection configurations (`ws://`, `http://`) are prohibited in production to protect application boundaries.
2.  **Uvicorn Worker Scaling Pool:** Configure production compute clusters running behind proxies to instantiate multiple workers using the standard execution template:
    ```bash
    uvicorn main:app --workers 4 --host 0.0.0.0 --port 8000
    

```

3. **Reverse Proxy Proxy Buffer Tuning:** Ensure reverse proxies (such as NGINX or ALB) do not cut long-running inactive connections prematurely. You must scale up default connection values:
```nginx
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;


```



```

```

```

```