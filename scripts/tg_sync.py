#!/usr/bin/env python3
"""Bulk Telegram message sync using Telethon directly.

Reads JSON from stdin: [{"chat_id": "123", "chat_name": "foo", "min_id": 0, "limit": 500}]
Outputs JSONL to stdout: one JSON line per chat with {chat_id, chat_name, messages}.

Reuses session from ~/.config/telegram-telethon/
Uses Telethon from lib/telethon submodule.
"""
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from telethon import TelegramClient
from telethon.tl.types import User, Chat, Channel
from telethon.errors import FloodWaitError

CONFIG_DIR = Path.home() / ".config" / "telegram-telethon"


def load_config():
    import yaml
    with open(CONFIG_DIR / "config.yaml") as f:
        return yaml.safe_load(f)


def get_chat_type(entity) -> str:
    if isinstance(entity, User):
        return "private"
    elif isinstance(entity, Chat):
        return "group"
    elif isinstance(entity, Channel):
        return "channel"
    return "unknown"


def format_message(msg, chat_name: str, chat_type: str) -> dict:
    sender_name = "Unknown"
    if msg.sender:
        if hasattr(msg.sender, 'first_name'):
            sender_name = msg.sender.first_name or ""
            if hasattr(msg.sender, 'last_name') and msg.sender.last_name:
                sender_name += f" {msg.sender.last_name}"
        elif hasattr(msg.sender, 'title'):
            sender_name = msg.sender.title

    reactions = []
    if hasattr(msg, 'reactions') and msg.reactions and hasattr(msg.reactions, 'results'):
        for r in msg.reactions.results:
            if hasattr(r, 'reaction') and hasattr(r.reaction, 'emoticon'):
                reactions.append({"emoji": r.reaction.emoticon, "count": r.count})

    result = {
        "id": msg.id,
        "chat": chat_name,
        "chat_type": chat_type,
        "sender": sender_name.strip(),
        "text": msg.text or "",
        "date": msg.date.isoformat() if msg.date else None,
    }
    if reactions:
        result["reactions"] = reactions
    return result


async def cmd_bulk(chats_spec: list, default_limit: int):
    config = load_config()
    session_path = str(CONFIG_DIR / "session")
    client = TelegramClient(session_path, config["api_id"], config["api_hash"])
    await client.start()

    total = len(chats_spec)
    try:
        for idx, spec in enumerate(chats_spec, 1):
            chat_id = spec.get("chat_id")
            chat_name = spec.get("chat_name")
            min_id = spec.get("min_id", 0)
            limit = spec.get("limit", default_limit)
            sys.stderr.write(f"[{idx}/{total}] {chat_name or chat_id} (min_id={min_id})\n")
            sys.stderr.flush()

            try:
                entity = None
                if chat_id:
                    cid = chat_id
                    if isinstance(cid, str) and cid.lstrip('-').isdigit():
                        cid = int(cid)
                    try:
                        entity = await client.get_entity(cid)
                    except Exception:
                        pass

                if entity is None and chat_name:
                    dialogs = await client.get_dialogs()
                    for d in dialogs:
                        if chat_name.lower() in (d.name or "").lower():
                            entity = d.entity
                            break

                if entity is None:
                    out = {"chat_id": str(chat_id or chat_name), "error": "not_found", "messages": []}
                    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
                    sys.stdout.flush()
                    continue

                chat_type = get_chat_type(entity)
                name = getattr(entity, 'title', None) or getattr(entity, 'first_name', '') or "Unknown"
                resolved_id = entity.id

                kwargs = {"limit": limit}
                if min_id > 0:
                    kwargs["min_id"] = min_id

                # Parse cutoff date — stop collecting when messages are older than this
                cutoff_date = None
                offset_date_str = spec.get("offset_date")
                if offset_date_str:
                    cutoff_date = datetime.fromisoformat(offset_date_str.replace("Z", "+00:00"))

                messages = []
                async for msg in client.iter_messages(entity, **kwargs):
                    if cutoff_date and msg.date and msg.date < cutoff_date:
                        break
                    messages.append(format_message(msg, name, chat_type))

                out = {
                    "chat_id": str(resolved_id),
                    "chat_name": name,
                    "messages": messages,
                }
                sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
                sys.stdout.flush()

            except FloodWaitError as e:
                sys.stderr.write(f"Rate limited on {chat_name or chat_id}, waiting {e.seconds}s...\n")
                await asyncio.sleep(e.seconds)
                out = {"chat_id": str(chat_id or chat_name), "error": f"flood_wait:{e.seconds}", "messages": []}
                sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
                sys.stdout.flush()
            except Exception as e:
                sys.stderr.write(f"Error fetching {chat_name or chat_id}: {e}\n")
                out = {"chat_id": str(chat_id or chat_name), "error": str(e), "messages": []}
                sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
                sys.stdout.flush()
    finally:
        await client.disconnect()


async def cmd_list(limit: int, since: str = None):
    config = load_config()
    session_path = str(CONFIG_DIR / "session")
    client = TelegramClient(session_path, config["api_id"], config["api_hash"])
    await client.start()

    cutoff = None
    if since:
        cutoff = datetime.fromisoformat(since.replace("Z", "+00:00"))

    try:
        sys.stderr.write(f"Fetching dialogs...\n")
        sys.stderr.flush()
        chats = []
        count = 0
        consecutive_old = 0
        CONSECUTIVE_OLD_THRESHOLD = 100  # Telethon pages internally in 100s
        async for d in client.iter_dialogs(limit=limit):
            count += 1
            if cutoff and d.date and d.date < cutoff:
                consecutive_old += 1
                if consecutive_old >= CONSECUTIVE_OLD_THRESHOLD:
                    sys.stderr.write(f"  Stopped at {count} dialogs ({CONSECUTIVE_OLD_THRESHOLD} consecutive old, cutoff {since})\n")
                    sys.stderr.flush()
                    break
                continue  # skip this old dialog but keep scanning
            else:
                consecutive_old = 0  # reset counter on any new dialog
            if count % 100 == 0:
                sys.stderr.write(f"  {count} dialogs...\n")
                sys.stderr.flush()
            chats.append({
                "id": d.id,
                "name": d.name or "Unnamed",
                "type": get_chat_type(d.entity),
                "unread": d.unread_count,
                "last_message_date": d.date.isoformat() if d.date else None,
            })
        sys.stderr.write(f"Got {len(chats)} dialogs\n")
        sys.stderr.flush()
        print(json.dumps(chats, ensure_ascii=False))
    finally:
        await client.disconnect()


async def cmd_status():
    config = load_config()
    session_path = str(CONFIG_DIR / "session")
    client = TelegramClient(session_path, config["api_id"], config["api_hash"])
    await client.start()
    try:
        me = await client.get_me()
        print(json.dumps({"connected": True, "user": me.first_name}))
    finally:
        await client.disconnect()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Traul Telegram sync")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("status", help="Check connection")

    list_p = sub.add_parser("list", help="List chats")
    list_p.add_argument("--limit", type=int, default=10000)
    list_p.add_argument("--json", action="store_true")
    list_p.add_argument("--since", type=str, default=None, help="ISO date cutoff — stop listing chats older than this")

    bulk_p = sub.add_parser("bulk-recent", help="Bulk fetch (JSON stdin)")
    bulk_p.add_argument("--limit", type=int, default=500)

    args = parser.parse_args()

    if args.command == "status":
        asyncio.run(cmd_status())
    elif args.command == "list":
        asyncio.run(cmd_list(args.limit, args.since))
    elif args.command == "bulk-recent":
        input_data = sys.stdin.read()
        chats = json.loads(input_data)
        asyncio.run(cmd_bulk(chats, args.limit))


if __name__ == "__main__":
    main()
