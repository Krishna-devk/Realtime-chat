from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
import uuid
import json
from datetime import datetime
from sqlalchemy import select

from .database import engine, Base, AsyncSessionLocal
from .models import Message, room_members
from .auth import decode_token
from .websocket.manager import manager
from .api.endpoints import auth, chat

app = FastAPI(title="Precision Messaging System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    user_id = str(payload.get("sub"))
    tab_id = str(uuid.uuid4())
    
    await manager.connect(user_id, tab_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_json = json.loads(data)
            
            if message_json.get("type") == "SEND_MESSAGE":
                room_id = str(message_json.get("room_id"))
                content = message_json.get("content")
                client_msg_id = str(message_json.get("client_msg_id"))
                
                async with AsyncSessionLocal() as db:
                    new_msg = Message(
                        client_msg_id=client_msg_id,
                        room_id=room_id,
                        sender_id=user_id,
                        content=content
                    )
                    db.add(new_msg)
                    
                    result = await db.execute(
                        select(room_members.c.user_id).where(room_members.c.room_id == room_id)
                    )
                    recipients = [str(r) for r in result.scalars().all()]
                    
                    await db.commit()
                    
                    await manager.publish_message({
                        "type": "NEW_MESSAGE",
                        "id": str(new_msg.id),
                        "room_id": room_id,
                        "sender_id": user_id,
                        "content": content,
                        "client_msg_id": client_msg_id,
                        "recipients": recipients,
                        "created_at": datetime.utcnow().isoformat()
                    })
    except WebSocketDisconnect:
        manager.disconnect(user_id, tab_id)
