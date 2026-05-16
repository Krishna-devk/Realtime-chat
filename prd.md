```markdown
# Product Requirement Document (PRD)

## Document Control
* **Project Name:** Real-Time Web Chat Application
* **Author:** Engineering & Product Team
* **Date:** May 16, 2026
* **Status:** Draft / Ready for Review
* **Target Stack:** FastAPI (Backend) + React JS (Web Frontend) + Redis (Pub/Sub) + MySQL (Database)

---

## 1. Executive Summary & Objective
The goal is to build a high-performance, single-page, real-time web chat application. The application will enable users to authenticate, join chat rooms, stream messages instantaneously, and view historical conversations seamlessly. 

The backend will leverage Python's asynchronous capabilities via **FastAPI** to manage persistent WebSocket connections, using **Redis** to synchronize states across server nodes. The frontend will be a responsive **React JS** single-page application (SPA) optimized for low latency, smooth scrolling, and multi-tab stability.

---

## 2. Scope & Exclusions

### In Scope
* User Authentication & Session Management (JWT via secure HTTP-Only cookies or short-lived parameters).
* One-on-One Direct Messaging (DM) and Multi-User Channels/Rooms.
* Real-time indicators: Message delivery/read status and user typing states.
* Infinite scrolling for historical message retrieval using cursor-based pagination.
* Multi-tab connection synchronization within a single browser window.

### Out of Scope (Phase 1)
* Native Mobile Applications (React Native is strictly deferred to Phase 2).
* Voice and Video calling (WebRTC).
* File and Media attachments (images, videos, documents).
* Message threading/replies and message pinning.

---

## 3. Architecture & High-Level System Design


```

┌──────────────────────────────────────────────────────────────┐
│                        WEB BROWSER                           │
│  ┌────────────────────────┐      ┌────────────────────────┐  │
│  │   React UI (Zustand)   │◄────►│  Browser Storage       │  │
│  └───────────▲────────────┘      │  (IndexedDB / Local)   │  │
│              │                   └────────────────────────┘  │
└──────────────┼───────────────────────────────────────────────┘
│ HTTP (Auth / History)
│ & WebSockets (Real-time Payload)
▼
┌──────────────────────────────────────────────────────────────┐
│                       FASTAPI BACKEND                        │
│  ┌────────────────────────┐      ┌────────────────────────┐  │
│  │ Connection Manager     │      │ APIRouter              │  │
│  │ (Active Tab Broadcast) │      │ (HTTP REST Endpoints)  │  │
│  └───────────┬────────────┘      └───────────┬────────────┘  │
└──────────────┼───────────────────────────────┼───────────────┘
▼                               ▼
┌──────────────────┐             ┌──────────────────┐
│ Redis Pub/Sub    │             │ MySQL       │
│ (Worker Sync)    │             │ (Message Store)  │
└──────────────────┘             └──────────────────┘

```

### Architectural Decisions & Constraints
1. **State Isolation:** WebSockets handle *live transit data frames only*. Historical tracking, room listings, and session handling are processed via standard HTTP REST endpoints.
2. **Horizontal Scaling:** FastAPI instances must remain completely stateless. Redis Pub/Sub acts as the central router to broadcast messages across isolated server workers.
3. **Authentication Boundary:** Standard browser WebSockets do not support custom authorization headers. Authentication will be validated via encrypted **HttpOnly Cookies** passed during the initial HTTP upgrade handshake, or via ephemeral URL-bound ticket tokens.

---

## 4. Functional Requirements

### 4.1 User Management & Authentication
* **FR-1.1:** A user must be able to sign up, log in, and log out via standard HTTP REST endpoints.
* **FR-1.2:** System must issue a secure, non-javascript-accessible (`HttpOnly`, `Secure`, `SameSite=Strict`) JWT cookie.
* **FR-1.3:** The system must reject WebSocket connections if a valid token or active session cookie is missing during the HTTP protocol upgrade.

### 4.2 Room & Channel Management
* **FR-2.1:** Users must be able to view a list of available public chat rooms and their active direct message list.
* **FR-2.2:** Users must be able to create a new room or initiate a direct conversation with another user ID.
* **FR-2.3:** FastAPI must validate channel authorization before subscribing a user's socket connection to a specific channel stream.

### 4.3 Real-Time Messaging Engine
* **FR-3.1:** Users must receive messages sent by others in the same room in under **200ms**.
* **FR-3.2:** The frontend must use an **Optimistic UI pattern**: when a user hits "Send", the message immediately renders locally with a pending icon. 
* **FR-3.3:** The backend must acknowledge message insertion via the WebSocket frame, upgrading the frontend message status from `pending` to `sent`.
* **FR-3.4:** Real-time events must cover the following actions:
  * `message_new`: Raw text delivery.
  * `typing_start` / `typing_stop`: Ephemeral states broadcast to other active members in the room.
  * `message_read`: Mark specific message offsets as read.

### 4.4 Data Persistence & Synchronization
* **FR-4.1:** All historical messages must be stored durably in MySQL.
* **FR-4.2:** Historical retrieval must use **Cursor-Based Pagination** (`GET /api/messages?room_id={id}&cursor={timestamp}&limit=50`). Offset-based pagination is prohibited to ensure high-speed reads across deep tables.
* **FR-4.3:** Multi-Tab Handling: If a user opens multiple browser tabs, all tabs must synchronize the UI live. FastAPI must map connections by a composite key of `user_id:session_id`.

---

## 5. Non-Functional Requirements (NFR)

### 5.1 Performance & Scalability
* **NFR-1.1:** The backend connection loop must run completely asynchronously (`async/await`) without blocking worker threads.
* **NFR-1.2:** Database persistence execution must run out-of-band via background worker tasks (`asyncio.create_task` or a background task runner) so database lock contention never blocks live socket frames.
* **NFR-1.3:** The frontend must use localized list windowing (virtualization via a library such as `react-virtuoso`). Rendering thousands of un-virtualized DOM elements concurrently is a critical failure threshold.

### 5.2 Reliability & Fault Tolerance
* **NFR-2.1:** **Heartbeats (Ping/Pong):** The FastAPI server must send an asynchronous ping payload every 30 seconds. If a client fails to reply with a pong within 15 seconds, the server must forcefully terminate the socket to prevent memory leak accumulation.
* **NFR-2.2:** **Exponential Backoff Reconnection:** If network connectivity drops, the frontend client must automatically attempt reconnection using an exponential delay backoff algorithm starting at 1s, doubling to a hard maximum limit of 30 seconds.
* **NFR-2.3:** **Reconnection Catch-Up:** Upon successful reconnection, the frontend must immediately request historical data over HTTP via the pagination endpoint using the timestamp of its last known received message. It must not rely on the WebSocket to backfill offline time windows.

### 5.3 Security
* **NFR-3.1:** All inputs, headers, and query strings passed through WebSocket boundaries must be scrubbed and explicitly validated to prevent XSS (Cross-Site Scripting) injections and payload contamination.
* **NFR-3.2:** Strict Cross-Origin Resource Sharing (CORS) rules must be implemented on the FastAPI tier to allow connection handshakes exclusively from verified domain origins.

---

## 6. WebSocket Unified Wire Schema

Every JSON frame traversing the WebSocket tunnel between the Client and Server must adhere strictly to the format detailed below to eliminate payload interpretation errors.

### 6.1 Server Inbound Client Frame (Client -> Server)
```json
{
  "event": "message_new",
  "payload": {
    "client_msg_id": "8f3b2a92-71c4-4d80-b2b9-e1e97dc2cb53",
    "room_id": "room_finance_01",
    "content": "Confirming receipt of the transaction documents.",
    "timestamp": 1781234567
  }
}

```

### 6.2 Server Outbound Broadcast Frame (Server -> Client)

```json
{
  "event": "message_new",
  "payload": {
    "id": "db_msg_9872146",
    "client_msg_id": "8f3b2a92-71c4-4d80-b2b9-e1e97dc2cb53",
    "room_id": "room_finance_01",
    "sender_id": "usr_alpha_99",
    "content": "Confirming receipt of the transaction documents.",
    "timestamp": 1781234567,
    "status": "sent"
  }
}

```

---

## 7. Metrics & Analytics Tracking

To ensure real-time system health and prevent degraded user experiences, the following operational indicators will be continuously aggregated:

* **Active Socket Count:** Real-time metrics tracking concurrent opened connections per node.
* **Delivery Latency Window:** Time tracking from when `client_msg_id` is created to when the database acknowledgment and client broadcast loops execute.
* **Socket Disconnect Rate:** Monitoring spike anomalies in unexpected socket drops to identify bad deployments or infrastructure-level proxy timeouts.

```

```