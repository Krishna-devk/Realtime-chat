from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class UserResponse(UserBase):
    id: str
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse

class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    room_id: str
    client_msg_id: str

class MessageResponse(MessageBase):
    id: str
    sender_id: str
    room_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ChatRoomBase(BaseModel):
    name: Optional[str] = None
    is_group: bool = False

class ChatRoomCreate(ChatRoomBase):
    member_ids: List[str]

class ChatRoomResponse(ChatRoomBase):
    id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
