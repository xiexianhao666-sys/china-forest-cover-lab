"""Current-Windows-user DPAPI cache; never stores account passwords."""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
from datetime import datetime, timezone

CACHE = Path(__file__).resolve().parent / ".secrets" / "appeears.dpapi"

def crypt(data, decrypt=False):
    if os.name != "nt":
        raise RuntimeError("加密缓存仅支持Windows；不会回退到明文保存。")
    class Blob(ctypes.Structure):
        _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_ubyte))]
    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    output = Blob()
    library = ctypes.WinDLL("crypt32", use_last_error=True)
    function = library.CryptUnprotectData if decrypt else library.CryptProtectData
    function.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.POINTER(Blob),
                         ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    function.restype = wintypes.BOOL
    free = ctypes.WinDLL("kernel32", use_last_error=True).LocalFree
    free.argtypes = [ctypes.c_void_p]
    free.restype = ctypes.c_void_p
    if not function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(output)):
        raise RuntimeError("Windows凭据加密/解密失败；请在原Windows用户下运行connect。")
    try:
        return ctypes.string_at(output.data, output.size)
    finally:
        free(ctypes.cast(output.data, ctypes.c_void_p))

def write_token(token, expiration, path=CACHE):
    if not token or not expiration:
        raise RuntimeError("服务未返回令牌或到期时间，未保存缓存。")
    # Validate expiration rather than keeping tokens indefinitely.
    parse_expiration(expiration)
    encrypted = crypt(json.dumps({"token": token, "expiration": expiration}).encode())
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_bytes(encrypted)
    temporary.replace(path)

def parse_expiration(value):
    time = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return time.replace(tzinfo=timezone.utc) if time.tzinfo is None else time

def read_token(path=CACHE):
    if not path.exists():
        return None
    try:
        content = json.loads(crypt(path.read_bytes(), decrypt=True))
        if parse_expiration(content["expiration"]) <= datetime.now(timezone.utc):
            return None
        return content["token"]
    except (ValueError, KeyError, OSError):
        raise RuntimeError("本地令牌缓存无效，请重新运行connect。") from None
