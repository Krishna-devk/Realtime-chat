import asyncio
import json
from typing import Dict, Any, List
from fastapi import WebSocket
import os
from dotenv import load_dotenv

load_dotenv()

class ClusterConnectionManager:
    """
    In-Memory Connection Manager (Single Instance).
    Replacing Redis/Postgres PubSub with a local memory bus as requested.
    """
    def __init__(self):
        # {user_id_str: {tab_session_id: WebSocket}}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, user_id: str, tab_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}
        self.active_connections[user_id][tab_id] = websocket

    def disconnect(self, user_id: str, tab_id: str):
        if user_id in self.active_connections:
            if tab_id in self.active_connections[user_id]:
                del self.active_connections[user_id][tab_id]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_users(self, user_ids: List[str], message_data: Dict[str, Any]):
        """
        Broadcasts message to all active sessions of the specified users.
        """
        for user_id in user_ids:
            if user_id in self.active_connections:
                for websocket in self.active_connections[user_id].values():
                    try:
                        await websocket.send_json(message_data)
                    except Exception:
                        # Dead connection will be handled by disconnect
                        pass

    async def publish_message(self, message_data: Dict[str, Any]):
        """
        Publishes a message to the internal bus.
        In this single-instance version, it broadcasts directly.
        """
        recipients = message_data.get("recipients", [])
        await self.broadcast_to_users(recipients, message_data)

manager = ClusterConnectionManager()
