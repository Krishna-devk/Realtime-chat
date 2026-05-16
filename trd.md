```markdown
# Technical Requirements Document (TRD)

## Document Control
* **Project Name:** Real-Time Web Chat Application Engine
* **System Version:** 1.0.0
* **Date:** May 16, 2026
* **Status:** Approved / Engineering Architecture Baseline

---

## 1. System Topology & Infrastructure Blueprint

The system architecture is strictly stateless across the compute tier to allow horizontal scaling. Stateful connections are bound to memory in local workers and synchronized cluster-wide via Redis.


```

```
                              [ Client Browser ]
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼ (HTTPS REST / TLS)                            ▼ (WSS Connection / TLS)
    ┌───────────────────┐                           ┌───────────────────┐
    │   Reverse Proxy   │                           │   Reverse Proxy   │
    │  (NGINX / ALB)    │                           │  (NGINX / ALB)    │
    └─────────┬─────────┘                           └─────────┬─────────┘
              │ Forward REST                                  │ Upgrade Protocol
              ▼                                               ▼
 ┌─────────────────────────┐                     ┌─────────────────────────┐
 │ FastAPI Instance Node A │                     │ FastAPI Instance Node B │
 │  (REST / Worker Sync)   │                     │  (Active WebSockets)    │
 └───────┬─────────┬───────┘                     └───────┬─────────┬───────┘
         │         │                                     │         │
         │         └───────────────┐     ┌───────────────┘         │
         ▼ Async Tasks             ▼     ▼ Pub/Sub Traffic         ▼ Async Tasks
   ┌───────────┐             ┌───────────────┐             ┌───────────┐
   │ MySQL│             │  Redis Cache  │             │ MySQL│
   │ (Primary) │             │ (Cluster Layer│             │ (Primary) │
   └───────────┘             └───────────────┘             └───────────┘

```

```

### 1.1 Technology Stack Matrix
| Component | Technology | Target Version | Configuration / Constraint |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | FastAPI | `^0.110.0` | Asynchronous (`asyncio` / Uvicorn worker) |
| **WS Engine** | WebSockets | Native Python | Explicit state tracking, no high-overhead abstracts |
| **Task Queueing** | Asyncio Tasks | Native | Out-of-band persistent storage scheduling |
| **Pub/Sub Broker** | Redis | `^7.2` | Channel-bound cluster synchronization |
| **Database** | MySQL | `^16.0` | Connection pooled, cursor indexed |
| **Frontend UI** | React JS | `^19.0` | TypeScript, functional components, strict mode |
| **Web State Engine**| Zustand | `^4.5` | Atomic updates, decoupled from React component lifecycle |

---

## 2. Backend Technical Architecture (FastAPI)

### 2.1 Connection Multiplexing & Tab Mapping Schema
To accurately govern multi-tab interactions without spawning duplicate memory models, FastAPI will utilize a dual-keyed registration dictionary:

```python
import asyncio
from fastapi import WebSocket
from typing import Dict, List

class ClusterConnectionManager:
    def __init__(self):
        # Topology Mapping: { user_id: { tab_session_id: WebSocket } }
        self.registry: Dict[str, Dict[str, WebSocket]] = {}

    async def register(self, user_id: str, tab_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.registry:
            self.registry[user_id] = {}
        self.registry[user_id][tab_id] = websocket

    def unregister(self, user_id: str, tab_id: str):
        if user_id in self.registry:
            if tab_id in self.registry[user_id]:
                del self.registry[user_id][tab_id]
            if not self.registry[user_id]:
                del self.registry[user_id]

    async def broadcast_to_user(self, user_id: str, payload: dict):
        if user_id in self.registry:
            # Broadcast to all active tabs concurrently
            tasks = [
                tab.send_json(payload) 
                for tab in self.registry[user_id].values()
            ]
            await asyncio.gather(*tasks, return_exceptions=True)

```

### 2.2 Redis Pub/Sub Distributed Routing Implementation

When scaled to multiple server instances, an instance receiving a message over a WebSocket must broadcast it to a Redis channel instead of assuming the recipient is connected to the same local machine.

```python
import json
import aioredis

async def redis_listener(manager: ClusterConnectionManager, redis_url: str):
    redis = await aioredis.from_url(redis_url)
    pubsub = redis.pubsub()
    await pubsub.subscribe("chat_cluster_channel")
    
    async for message in pubsub.listen():
        if message['type'] == 'message':
            data = json.loads(message['data'])
            # Target routing based on system registry check
            target_user = data.get("target_user_id")
            await manager.broadcast_to_user(target_user, data['payload'])

```

### 2.3 Non-Blocking Out-of-Band DB Persistence

The real-time streaming pipeline must completely bypass the database completion barrier. Database writes are scheduled as standard asyncio background tasks to eliminate transport blockages.

```python
from fastapi import BackgroundTasks

@app.websocket("/ws/{user_id}/{tab_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, tab_id: str, background_tasks: BackgroundTasks):
    await manager.register(user_id, tab_id, websocket)
    try:
        while True:
            raw_data = await websocket.receive_text()
            parsed_payload = process_and_validate(raw_data)
            
            # 1. Immediate Broadcast to cluster via Redis Pub/Sub
            await publish_to_redis(parsed_payload)
            
            # 2. Defer I/O block out of execution loop
            background_tasks.add_task(persist_to_Mys, parsed_payload)
            
    except Exception:
        manager.unregister(user_id, tab_id)

```

---

## 3. Database Schema & Query Optimization (MySQL)

### 3.1 DDL Schema Blueprint

The system uses UUID primary keys for client decoupling, combined with a composite index architecture configured for historical timestamp queries.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NULL, -- Null implies a generic Direct Message conversation
    is_group BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE room_members (
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_msg_id UUID UNIQUE NOT NULL,
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crucial Performance Indexes for Pagination Optimization
CREATE INDEX idx_messages_room_timestamp ON messages (room_id, created_at DESC);

```

### 3.2 Cursor Pagination Implementation

Offset pagination (`LIMIT 50 OFFSET 50000`) degrades exponentially due to full-table pointer scans. This engine enforces strict cursor paginating utilizing the `created_at` timestamp parameter constraint.

```sql
-- Fetching Page 1
SELECT id, client_msg_id, sender_id, content, created_at 
FROM messages 
WHERE room_id = :room_id 
ORDER BY created_at DESC 
LIMIT 50;

-- Fetching Page 2 (Cursor set to the timestamp of the 50th message from Page 1)
SELECT id, client_msg_id, sender_id, content, created_at 
FROM messages 
WHERE room_id = :room_id AND created_at < :cursor_timestamp
ORDER BY created_at DESC 
LIMIT 50;

```

---

## 4. Frontend Engineering (React JS + Zustand)

### 4.1 Memory-Isolated State Pipeline (Zustand Store)

To avoid performance degradation under high-frequency UI updates, React components must select data points slice-by-slice without triggering global renders across parent components.

```typescript
import { create } from 'zustand';

interface Message {
  client_msg_id: string;
  content: string;
  sender_id: string;
  status: 'pending' | 'sent' | 'failed';
  timestamp: number;
}

interface ChatState {
  messagesByRoom: Record<string, Message[]>;
  addMessage: (roomId: string, message: Message) => void;
  updateMessageStatus: (roomId: string, clientMsgId: string, status: 'sent' | 'failed') => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messagesByRoom: {},
  addMessage: (roomId, message) => set((state) => {
    const currentRoomMessages = state.messagesByRoom[roomId] || [];
    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: [...currentRoomMessages, message]
      }
    };
  }),
  updateMessageStatus: (roomId, clientMsgId, status) => set((state) => {
    const currentRoomMessages = state.messagesByRoom[roomId] || [];
    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: currentRoomMessages.map((msg) => 
          msg.client_msg_id === clientMsgId ? { ...msg, status } : msg
        )
      }
    };
  })
}));

```

### 4.2 Browser Dom Virtualization Implementation

The viewport will wrap messages within a virtualized container using a windowing component. If a chat channel aggregates thousands of active records, the browser DOM overhead remains restricted strictly to the nodes currently visible within the active screen bounds.

---

## 5. Resiliency & Connection Lifecycles

### 5.1 Exponential Backoff Connection Pipeline

If the continuous streaming connection drops, the application core must execute a standardized reconnection strategy using the following mathematical sequence:

$$\text{Delay} = \min(\text{base\_delay} \times 2^{\text{attempt}}, \text{max\_delay})$$

Where $\text{base\_delay} = 1\text{s}$ and $\text{max\_delay} = 30\text{s}$.

```typescript
class WebSocketClient {
  private url: string;
  private attempt = 0;
  private ws!: WebSocket;

  constructor(url: string) { this.url = url; }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onclose = () => {
      const delay = Math.min(1000 * Math.pow(2, this.attempt), 30000);
      this.attempt++;
      setTimeout(() => this.connect(), delay);
    };

    this.ws.onopen = () => {
      this.attempt = 0; // Clear attempts on recovery
    };
  }
}

```

### 5.2 Server Heartbeat Verification Matrix

```
Client Browser                                             FastAPI Server
      │                                                          │
      │ ◄──────────────── Ping Payload (Frame) ──────────────────┤ (Every 30s)
      │                                                          │
      ├─► Pong Acknowledgment (Frame) ──────────────────────────►│ (Must arrive within 15s)
      │                                                          │ ──┐
      │                                                          │   │ If missed:
      │                                                          │   │ Force Disconnect &
      │                                                          │   │ Clear Cluster RAM
      │                                                          │ ◄─┘

```

---

## 6. Security Infrastructure Checklist

* **Handshake Defense:** The gateway configuration must explicitly filter incoming WebSocket `Upgrade` headers. Connections originating from cross-origin endpoints lacking matching CORS parameter controls must instantly trigger a `403 Forbidden` classification before processing the handshake lifecycle.
* **Payload Sanitation Layer:** Message parsing logic must feed incoming strings through an explicit escaping process to prevent cross-site scripting (XSS) vectors before broadcast serialization.

```
</ChatState>

```