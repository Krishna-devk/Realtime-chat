from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from ...database import get_db
from ...models import ChatRoom, User, Message, room_members
from ...schemas import ChatRoomCreate, ChatRoomResponse, MessageResponse

router = APIRouter(prefix="/rooms", tags=["chat"])

@router.post("/", response_model=ChatRoomResponse)
async def create_room(room_in: ChatRoomCreate, db: AsyncSession = Depends(get_db)):
    new_room = ChatRoom(name=room_in.name, is_group=room_in.is_group)
    db.add(new_room)
    
    # Add members
    for user_id in room_in.member_ids:
        user = await db.get(User, user_id)
        if user:
            new_room.members.append(user)
            
    await db.commit()
    await db.refresh(new_room)
    return new_room

@router.get("/", response_model=List[ChatRoomResponse])
async def list_rooms(user_id: str, db: AsyncSession = Depends(get_db)):
    # List rooms where user is a member
    query = select(ChatRoom).join(ChatRoom.members).where(User.id == user_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{room_id}/messages", response_model=List[MessageResponse])
async def get_messages(room_id: str, db: AsyncSession = Depends(get_db), limit: int = 50):
    query = select(Message).where(Message.room_id == room_id).order_by(Message.created_at.desc()).limit(limit)
    result = await db.execute(query)
    messages = result.scalars().all()
    return messages[::-1] # Return in chronological order
