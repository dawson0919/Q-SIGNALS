"""
Gmail Agent — Claude Agent SDK + Composio MCP
用途：透過 Claude AI 讀取 Gmail，可用於抓取交易相關郵件、帳單通知等。

用法：
  第一次執行（授權 Gmail）：
    py -3.13 scripts/gmail_agent.py --auth

  正常讀取 Gmail：
    py -3.13 scripts/gmail_agent.py
    py -3.13 scripts/gmail_agent.py --query "顯示最新 5 封未讀郵件"
    py -3.13 scripts/gmail_agent.py --query "搜尋主旨包含 trading 的郵件"
"""

import asyncio
import argparse
import os
import sys
from pathlib import Path

# Force UTF-8 output on Windows
import io
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Load .env from project root
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

COMPOSIO_API_KEY = os.environ.get("COMPOSIO_API_KEY")
COMPOSIO_USER_ID = os.environ.get("COMPOSIO_USER_ID")

if not COMPOSIO_API_KEY:
    print("❌ 缺少 COMPOSIO_API_KEY，請確認 .env 設定")
    sys.exit(1)


# ── Authorization flow (one-time setup) ────────────────────────────────────────

def authorize_gmail():
    """完成 Gmail OAuth 授權（只需執行一次）"""
    from composio import Composio
    from composio_claude_agent_sdk import ClaudeAgentSDKProvider

    print("🔐 開始 Gmail OAuth 授權流程...")
    composio = Composio(
        api_key=COMPOSIO_API_KEY,
        provider=ClaudeAgentSDKProvider()
    )
    session = composio.create(
        user_id=COMPOSIO_USER_ID,
        manage_connections=False,
    )

    connection_request = session.authorize(
        toolkit="gmail",
        callback_url="https://q-signals-production.up.railway.app/oauth/callback"
    )

    print(f"\n📧 請用瀏覽器開啟以下網址完成 Gmail 授權：\n")
    print(f"   {connection_request.redirect_url}\n")
    print("等待授權完成（最多 3 分鐘）...")

    try:
        connected_account = connection_request.wait_for_connection(timeout=180)
        print(f"✅ Gmail 授權成功！連線 ID：{connected_account.id}")
    except Exception as e:
        print(f"❌ 授權等待逾時或失敗：{e}")
        print("請確認已完成瀏覽器中的 OAuth 步驟後重試。")
        sys.exit(1)


# ── Gmail reading agent ────────────────────────────────────────────────────────

async def run_gmail_agent(query: str):
    """使用 Claude Agent + Composio MCP 執行 Gmail 查詢"""
    from composio import Composio
    from composio_claude_agent_sdk import ClaudeAgentSDKProvider
    from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, create_sdk_mcp_server

    print(f"🤖 啟動 Gmail Agent...")
    print(f"📋 任務：{query}\n")

    composio = Composio(
        api_key=COMPOSIO_API_KEY,
        provider=ClaudeAgentSDKProvider()
    )

    # 建立工具路由 session，取得 Gmail MCP 工具
    session = composio.create(user_id=COMPOSIO_USER_ID)
    tools = session.tools()

    # 過濾只留 Gmail 相關工具
    gmail_tools = [t for t in tools if "gmail" in str(getattr(t, "name", "")).lower()
                   or "GMAIL" in str(getattr(t, "name", "")).upper()]

    print(f"🔧 已載入 {len(tools)} 個 Composio 工具（Gmail 相關：{len(gmail_tools)} 個）")

    # 建立 MCP 伺服器
    custom_server = create_sdk_mcp_server(
        name="composio",
        version="1.0.0",
        tools=tools  # 傳入全部工具，讓 Claude 自己選擇
    )

    options = ClaudeAgentOptions(
        system_prompt=(
            "你是一個 Gmail 助理，擅長讀取、搜尋、整理電子郵件。\n"
            "使用繁體中文回應。\n"
            "回答時請清楚列出郵件主旨、寄件者、時間、內容摘要。"
        ),
        permission_mode="bypassPermissions",
        mcp_servers={
            "composio": custom_server,
        },
    )

    print("─" * 60)

    async with ClaudeSDKClient(options=options) as client:
        await client.query(query)

        async for msg in client.receive_response():
            msg_type = type(msg).__name__

            if msg_type == "AssistantMessage":
                for block in getattr(msg, "content", []):
                    block_type = type(block).__name__
                    if block_type == "TextBlock":
                        print(block.text, end="", flush=True)
                    elif block_type == "ToolUseBlock":
                        print(f"\n[🔧 呼叫工具：{block.name}]", flush=True)

            elif msg_type == "ResultMessage":
                cost = getattr(msg, "total_cost_usd", None)
                duration = getattr(msg, "duration_ms", None)
                print(f"\n\n─" * 30)
                if cost is not None:
                    print(f"✅ 完成 | 費用：${cost:.4f} | 耗時：{duration}ms")
                break

    print()


# ── Entry point ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Gmail Agent — Claude + Composio")
    parser.add_argument(
        "--auth",
        action="store_true",
        help="執行 Gmail OAuth 授權（首次使用必須執行）"
    )
    parser.add_argument(
        "--query", "-q",
        type=str,
        default="列出最新 5 封郵件，顯示寄件者、主旨和時間",
        help="要詢問 Gmail 的問題（預設：列出最新 5 封）"
    )
    args = parser.parse_args()

    if args.auth:
        authorize_gmail()
    else:
        asyncio.run(run_gmail_agent(args.query))


if __name__ == "__main__":
    main()
