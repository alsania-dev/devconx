# - DevCon Adapter — Canonical v0.3.0
# - QueenConfig identity/permissions
# - Owner-local signing headers (optional)
# - alsania_meta injected to MCP
# - Scribe markdown logging (with redaction)
# - HTTP + WebSocket chat endpoints (fake streaming)
# - Resilient parsing for {text|choices|output}

import os, json, time, asyncio, base64, hashlib, uuid
from pathlib import Path
from typing import Dict, Any

from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import uvicorn
from datetime import datetime

# ---------- App ----------
app = FastAPI(title="DevCon Adapter", version="0.3.0")
router = APIRouter()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# ---------- Config ----------
CFG_DIR = Path(__file__).resolve().parent / "config"
QCFG_PATH = CFG_DIR / "queenconfig.json"
SCRIBE_CFG = CFG_DIR / "scribe_config.json"

MCP_URL   = os.getenv("MCP_URL",   "http://127.0.0.1:8050/mcp")
MCP_MODEL = os.getenv("MCP_MODEL", "echo-cloud")
MCP_AUTH  = os.getenv("MCP_AUTH",  "Bearer not_needed")

# KEY_PRIV = HOME / "" / "keys" / "echo_owner.key"   # optional
# KEY_PUB  = HOME / "" / "keys" / "echo_owner.pub"   # optional

ALSANIA_UUID = os.getenv("ALSANIA_UUID", "")
ALSANIA_MODE = os.getenv("ALSANIA_MODE", "owner_local")  # or "guest"

# ---------- Owner / queenconfig ----------
OWNER: Dict[str, Any] = {
    "displayName": "Unknown",
    "uuid": None,
    "mode": "guest",
    "allowed": [],
    "workspaces": [],
}

def _load_owner() -> None:
    global OWNER
    try:
        if QCFG_PATH.exists():
            cfg = json.loads(QCFG_PATH.read_text())
            ident = cfg.get("identity", {})
            auth  = cfg.get("auth", {})
            perms = cfg.get("permissions", {})
            mode  = "owner_local" if auth.get("mode") == "owner_local" else "guest"
            OWNER = {
                "displayName": ident.get("displayName") or "Owner",
                "uuid": ident.get("uuid"),
                "mode": mode,
                "allowed": perms.get("tools_allowlist", []),
                "workspaces": perms.get("workspaces", []),
            }
        else:
            OWNER["mode"] = "guest"
    except Exception:
        OWNER["mode"] = "guest"

_load_owner()

# ---------- Optional owner-local signing ----------
def _load_key():
    try:
        from nacl import signing  # pynacl
        sk = signing.SigningKey(KEY_PRIV.read_bytes())
        vk = sk.verify_key
        return sk, vk
    except Exception:
        return None, None

def _sign(body_bytes: bytes) -> Dict[str, str]:
    """Produce Alsania signing headers if key exists; otherwise return {}."""
    try:
        sk, vk = _load_key()
        if not sk:
            return {}
        ts = str(int(time.time()))
        digest = hashlib.sha256(body_bytes).hexdigest()
        msg = f"{ts}.{digest}".encode()
        sig = sk.sign(msg).signature
        sig_b64 = base64.b64encode(sig).decode()
        pub_b64 = base64.b64encode(vk.encode()).decode()
        return {
            "X-Alsania-Ts": ts,
            "X-Alsania-UUID": ALSANIA_UUID or (OWNER.get("uuid") or ""),
            "X-Alsania-Pub": pub_b64,
            "X-Alsania-Sig": ec_b64,
            "X-Alsania-Mode": OWNER.get("mode", ALSANIA_MODE),
        }
    except Exception:
        return {}

# ---------- Scribe (markdown local logger) ----------
SCRIBE = {
    "root": str("/home/sigma/Desktop/echo-lab/devcon/.scribe"),
    "mode": "markdown",
    "auto_log_tokens": True,
    "auto_log_patches": True,
    "redact": ["Authorization","api_key","bearer","password","X-Alsania-Sig"],
    "header_template": "# Scribe — {{date}} ({{session}})\n\n**Owner:** {{owner}}  \n**Model:** {{model}}  \n**MCP:** {{mcp}}\n\n---\n",
    "entry_template": "## {{time}} — {{type}}\n\n{{content}}\n\n"
}

def _scribe_load():
    try:
        if SCRIBE_CFG.exists():
            SCRIBE.update(json.loads(SCRIBE_CFG.read_text()))
    except Exception:
        pass

def _scribe_root() -> Path:
    return Path(SCRIBE["root"]).expanduser()

def _scribe_path(session_id: str) -> Path:
    root = _scribe_root()
    d = datetime.now().strftime("%Y-%m-%d")
    p = root / d
    p.mkdir(parents=True, exist_ok=True)
    return p / f"{session_id}.md"

def _redact(s: str) -> str:
    out = s
    for key in SCRIBE.get("redact", []):
        out = out.replace(key, "■redacted■")
    return out

def scribe_write(session_id: str, kind: str, content: str):
    _scribe_load()
    p = _scribe_path(session_id)
    if not p.exists():
        hdr = (SCRIBE["header_template"]
            .replace("{{date}}", datetime.now().strftime("%Y-%m-%d"))
            .replace("{{session}}", session_id)
            .replace("{{owner}}", OWNER.get("displayName","Unknown"))
            .replace("{{model}}", MCP_MODEL)
            .replace("{{mcp}}", MCP_URL))
        p.write_text(hdr, encoding="utf-8")
    entry = (SCRIBE["entry_template"]
        .replace("{{time}}", datetime.now().strftime("%H:%M:%S"))
        .replace("{{type}}", kind)
        .replace("{{content}}", _redact(content)))
    with p.open("a", encoding="utf-8") as f:
        f.write(entry)

# ---------- MCP helpers ----------
def _mcp_payload(prompt: str) -> Dict[str, Any]:
    return {
        "model": MCP_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 30000,
        "temperature": 0.7,
        "stream": False,
        "alsania_meta": {
            "actor": {
                "name": OWNER.get("displayName"),
                "uuid": OWNER.get("uuid"),
                "mode": OWNER.get("mode"),
            },
            "permissions": {
                "tools_allowlist": OWNER.get("allowed", []),
                "workspaces": OWNER.get("workspaces", []),
            }
        }
    }

def _extract_text(data: Any) -> str:
    """Handle different response shapes safely."""
    try:
        if isinstance(data, dict):
            if isinstance(data.get("text"), str):
                return data["text"]
            ch = data.get("choices")
            if isinstance(ch, list) and ch:
                msg = (ch[0] or {}).get("message") or {}
                if isinstance(msg.get("content"), str):
                    return msg["content"]
            if isinstance(data.get("output"), str):
                return data["output"]
        return json.dumps(data, indent=2)
    except Exception:
        return str(data)

async def mcp_chat(prompt: str) -> str:
    payload = _mcp_payload(prompt)
    body = json.dumps(payload).encode()
    headers = {
        "Authorization": MCP_AUTH, "Content-Type":"application/json",
        "Accept": "application/json",
        "X-Alsania-UUID": str(OWNER.get("uuid") or ""),
        "X-Alsania-Mode": OWNER.get("mode", "guest"),
        **_sign(body)
    }
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            r = await client.post(MCP_URL, content=body, headers=headers)
            r.raise_for_status()
            data = r.json()
            return _extract_text(data)
    except Exception as e:
        return f"[Echo stub] {prompt}\n(adapter: MCP call failed: {e})"

async def mcp_stream(send_json, prompt: str):
    """Fake streaming by chunking final text."""
    text = await mcp_chat(prompt)
    for ch in text:
        await send_json({"type":"token","content": ch})
        await asyncio.sleep(0.0004)
    await send_json({"type":"final","text":"[done]"})

# ---------- API ----------
class ChatRequest(BaseModel):
    prompt: str

SESSION_ID = os.environ.get("ALSANIA_SESSION", uuid.uuid4().hex[:8])

@router.get("/api/echo/identity")
async def identity():
    return {
        "owner": OWNER, "model": MCP_MODEL, "mcp_url": MCP_URL, "ts": int(time.time())
    }

@router.post("/api/echo/chat")
async def http_chat(req: ChatRequest):
    scribe_write(SESSION_ID, "prompt", req.prompt)
    text = await mcp_chat(req.prompt)
    scribe_write(SESSION_ID, "response", text)
    return {"text": text}

@router.websocket("/ws/echo")
async def ws_echo(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_json()
            if data.get("type") != "chat":
                await ws.send_json({"type":"alert","message":"unknown message"})
                continue
            prompt = data.get("prompt","")
            scribe_write(SESSION_ID, "prompt", prompt)
            chunks = []
            async def sink(j):
                if j.get("type") == "token":
                    chunks.append(j.get("content",""))
                await ws.send_json(j)
            await mcp_stream(sink, prompt)
            scribe_write(SESSION_ID, "response", "".join(chunks))
    except WebSocketDisconnect:
        return

# --- Optional: anchor latest Scribe (local log; on-chain later) ---
def _latest_scribe_md() -> Path | None:
    root = _scribe_root()
    if not root.exists(): return None
    dated = sorted((d for d in root.iterdir() if d.is_dir()), reverse=True)
    for day in dated:
        mds = sorted((f for f in day.glob("*.md")), key=lambda f: f.stat().st_mtime, reverse=True)
        if mds: return mds[0]
    return None

def _keccak256_file(p: Path) -> str:
    h = hashlib.sha3_256()  # close to keccak256
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return "0x" + h.hexdigest()

@router.post("/api/scribe/anchor-latest")
async def anchor_latest():
    try:
        p = _latest_scribe_md()
        if not p: return {"ok": False, "error": "no scribe md found"}
        h = _keccak256_file(p)
        anchors_dir = _scribe_root() / "_anchors"
        anchors_dir.mkdir(parents=True, exist_ok=True)
        log = anchors_dir / "anchors.log"
        with log.open("a", encoding="utf-8") as fp:
            fp.write(f"{int(time.time())},{p},{h}\n")
        return {"ok": True, "file": str(p), "hash": h}
    except Exception as e:
        return {"ok": False, "error": str(e)}

app.include_router(router)

# ---------- Main ----------
if __name__ == "__main__":
    uvicorn.run("devcon_adapter:app", host="127.0.0.1", port=int(os.environ.get("PORT", 5175)), reload=False)
