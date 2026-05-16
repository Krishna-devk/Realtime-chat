```markdown
# Application Flow & Lifecycle Document (AFLD)

## Document Control
* **Project Name:** Real-Time Web Chat Application Flow
* **System Version:** 1.0.0
* **Date:** May 16, 2026
* **Status:** Finalized Engineering Spec

---

## 1. Application Initialization & Authentication Flow

This flow governs what happens when a user first navigates to the web application URL (`https://chat.domain.com`). It ensures state synchronization before the UI is rendered to the user.


```

[ User Browser ]                  [ React SPA Frontend ]            [ FastAPI Gateway ]            [ MySQL DB ]
│                                     │                               │                              │
│ ─── 1. Navigate to URL ────────────►│                               │                              │
│                                     │ ─── 2. Inspect Cookie / JWT ─►│                              │
│                                     │                               │ ─── 3. Validate Session ────►│
│                                     │                               │◄─── 4. Return User Session ──┤
│                                     │◄─── 5. Resolve Auth State ────┤                              │
│                                     │                               │                              │
│                                     ├─── 6. [Auth Valid] ──────────┐│                              │
│                                     │       Initialize UI Engine   ││                              │
│                                     │◄─────────────────────────────┘│                              │
│                                     │                               │                              │
│                                     │ ─── 7. GET /api/rooms ───────►│                              │
│                                     │◄─── 8. Return Room List ──────┤                              │
│◄─── 9. Render Chat Workspace ───────┤                               │                              │

```

### Technical Step-by-Step Breakdown
1. **Initial Hydration:** The React application initializes a global Zustand authentication store. It reads the local state to determine if an active session exists.
2. **Session Interrogation:** An HTTP `GET /api/v1/auth/me` request is dispatched to FastAPI. Since authentication is bound to secure `HttpOnly` cookies, the browser automatically attaches the credential payload.
3. **Gateway Authorization:** 
   * **Success Path:** FastAPI decodes the token, verifies user status against MySQL, and returns a `200 OK` JSON payload containing user metadata (`id`, `username`, `avatar`). The frontend boots the main dashboard workspace.
   * **Failure Path:** If the cookie is expired or missing, FastAPI returns a `401 Unauthorized` block. The frontend instantly clears local caches and drops the routing layer to the `/login` view.

---

## 2. Real-Time Connection Establishment (WebSocket Handshake)

Once the application confirms valid authentication, it initiates a persistent WebSocket connection to stream live event payloads.


```

[ React SPA Frontend ]            [ Reverse Proxy (NGINX) ]           [ FastAPI Instance ]          [ Cluster Registry ]
│                                    │                                │                             │
│ ── 1. wss:// Connection Request ──►│                                │                             │
│      (With unique Tab Session ID)  │ ── 2. Strip / Upgrade Protocol►│                             │
│                                    │                                │ ── 3. Parse Auth Cookie ───┐│
│                                    │                                │      & Match Identifiers   ││
│                                    │                                │◄───────────────────────────┘│
│                                    │                                │                             │
│                                    │                                │ ── 4. Save Conn Pointers ──►│
│◄── 6. Connection Accepted (101) ───┼────────────────────────────────┤                             │
│                                    │                                │                             │
│ ── 7. Execute Heartbeat Loop ◄─────┼───────────────────────────────►│ (Continuous Ping/Pong)      │

```

### Technical Step-by-Step Breakdown
1. **Unique Tab Identification:** The React frontend generates an ephemeral UUIDv4 string stored in memory (`window.tabSessionId`). This prevents state conflicts across open tabs.
2. **Protocol Upgrade Request:** The client instantiates the connection:
   ```typescript
   const ws = new WebSocket(`wss://[api.domain.com/ws/connect?tab_id=$](https://api.domain.com/ws/connect?tab_id=$){window.tabSessionId}`);

```

3. **Proxy Gateway Transition:** The reverse proxy intercepts the request, validates that the source matches authorized CORS origin fields, verifies the presence of the `Upgrade: websocket` header, and forwards the TCP frame stream directly to Uvicorn workers.
4. **Server Validation and Handshake:** FastAPI intercepts the session cookie mid-handshake. If authorization checks pass, FastAPI fires a `101 Switching Protocols` response frame back down the pipeline and registers the connection inside the `ClusterConnectionManager` instance memory mapping.

---

## 3. Message Transmission & Dynamic State Updates

This flow covers what occurs when a user types a message and hits enter. It relies on the **Optimistic UI Pattern** to mask network latency.

```
[ Client A (React) ]            [ FastAPI Worker 1 ]             [ Redis Pub/Sub ]             [ FastAPI Worker 2 ]            [ Client B (Tab 1) ]
         │                               │                               │                               │                               │
         ├── 1. Render Local Message ┐   │                               │                               │                               │
         │      (State: "pending")   │   │                               │                               │                               │
         │◄──────────────────────────┘   │                               │                               │                               │
         │                               │                               │                               │                               │
         │ ── 2. WS: message_new ───────►│                               │                               │                               │
         │                               │ ── 3. Publish to Cluster ────►│                               │                               │
         │                               │                               │ ── 4. Relay Payload ─────────►│                               │
         │                               │                               │                               │ ── 5. WS: message_new ───────►│
         │◄── 6. WS: message_ack ────────┤                               │                               │                               │
         │                               │                               │                               │                               │
         │                               │ ── 7. Defer DB Persist ───────┼───────────────────────────────┼───────────────► [ MySQL DB ]

```

### Technical Step-by-Step Breakdown

1. **Optimistic Injection:** When the user hits send, Client A generates a local tracking identity payload (`client_msg_id`) and appends it to the active Zustand store array with an explicit status flag set to `pending`. The message immediately renders in the viewport.
2. **Outbound Transmission:** Client A passes the message payload down the open WebSocket connection pipe as a stringified JSON frame.
3. **Ingress Processing:** FastAPI Worker 1 intercepts the message, decodes the schema layout, appends the verified `sender_id` context tied to the socket session, and broadcasts a wrapped payload payload over the Redis Redis Pub/Sub cluster channel `chat_cluster_channel`.
4. **Cluster Broadcast:** All stateless FastAPI instances subscribed to the Redis channel intercept the payload frame:
* **Worker 1 (Local):** Sends a structural confirmation message back to Client A matching the original tracking identity (`client_msg_id`). Client A catches this event frame and updates the status flag within the local state array from `pending` to `sent`.
* **Worker 2 (Remote):** Detects that the target user recipient is bound to its local worker network loop. It automatically serializes the text data packet and pushes it down the WebSocket connection belonging to Client B.


5. **Asynchronous Persist Pipeline:** Simultaneously, FastAPI Worker 1 spawns an isolated background operation context using an async execution queue (`asyncio.create_task`) to insert the data array into the MySQL database cluster table securely without blocking thread response cycles.

---

## 4. Lifecycle Disconnection & Auto-Reconnection Flow

This model details system execution when network routing matrices drop, such as local Wi-Fi drops, ISP failures, or server-enforced connection closures.

```
[ Client Browser ]                 [ React State Engine ]               [ FastAPI Gateway ]             [ Cluster Registry ]
        │                                    │                                   │                               │
        X  ◄── [Network Connection Drops] ───X                                   │                               │
        │                                    │                                   │                               │
        │                                    │ ── 1. Catch ws.onclose Event ────►│                               │
        │                                    │                                   │ ── 2. Evict Connection ──────►│
        │                                    ├── 3. [Execute Math Calculation]  │                               │
        │                                    │      Delay = Base * 2^Attempt     │                               │
        │                                    │◄──────────────────────────────────┘                               │
        │                                    │                                   │                               │
        │ ── 4. Re-establish Handshake ─────►│                                   │                               │
        │                                    │ ── 5. GET /api/messages/sync ────►│                               │
        │                                    │      (Fetch Missed Delta Time)    │ ── 6. Query Message Gap ─────► [ MySQL DB ]
        │                                    │◄── 7. Return Delinquent Delta ────┼◄──────────────────────────────┤
        │◄── 8. Re-align Live Sync UI ───────┤                                   │                               │

```

### Technical Step-by-Step Breakdown

1. **Clean Failure Capture:** The instant the physical TCP link encounters interruption errors, the browser engine triggers the standard structural hook event `ws.onclose`.
2. **Server Cleanup Execution:** On the server side, FastAPI detects the termination event. The connection object manager calls its internal drop registry routines to scrub dead socket pointers out of cluster RAM matrices, halting dead write allocations.
3. **Exponential Retries Pipeline:** The React state engine blocks standard UI interface text inputs and triggers a backoff scheduling algorithm. It blocks immediate rapid reconnection loop requests to protect server instances against distributed denial of service constraints (thundering herd problem).
4. **State Backfill Sequence (The Catch-up):** Upon resolving the connection failure loop and completing a new WebSocket upgrade process, the client frontend does not guess what messages it missed. It fetches the timestamp of the newest verified message present inside its local state cache and executes a targeted REST synchronization request:
```http
GET /api/v1/messages/sync?room_id=room_01&since_timestamp=1781234567


```



```
5. **Data Merge Isolation:** FastAPI pulls the data delta generated during the user's offline time window from MySQL. The frontend merges the missing chronological blocks into the Zustand data array store and transitions the application layout back to an active state.

```

```

```