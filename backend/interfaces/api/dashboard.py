"""
Internal Metrics Dashboard — Simple HTML UI served from FastAPI.

No frontend framework needed. Just plain HTML/CSS/JS.
"""
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from datetime import datetime
from prometheus_client import REGISTRY

router = APIRouter(tags=["Internal"])


def get_metrics_data() -> dict:
    """Extract current metrics from Prometheus registry."""
    metrics = {
        "requests": {},
        "latency": {},
        "in_progress": {},
        "python_info": {},
    }
    
    for metric in REGISTRY.collect():
        for sample in metric.samples:
            name = sample.name
            labels = sample.labels
            value = sample.value
            
            if "http_requests_total" in name and not name.endswith("_created"):
                key = f"{labels.get('method', '')} {labels.get('endpoint', '')}"
                if key not in metrics["requests"]:
                    metrics["requests"][key] = {"total": 0, "by_status": {}}
                status = labels.get("status", "unknown")
                metrics["requests"][key]["by_status"][status] = int(value)
                metrics["requests"][key]["total"] += int(value)
                
            elif "request_duration_seconds_sum" in name:
                key = f"{labels.get('method', '')} {labels.get('endpoint', '')}"
                metrics["latency"][key] = {"sum": value}
                
            elif "request_duration_seconds_count" in name:
                key = f"{labels.get('method', '')} {labels.get('endpoint', '')}"
                if key in metrics["latency"]:
                    metrics["latency"][key]["count"] = int(value)
                    if value > 0:
                        metrics["latency"][key]["avg_ms"] = round((metrics["latency"][key]["sum"] / value) * 1000, 2)
                        
            elif "requests_in_progress" in name and not name.endswith("_created"):
                key = f"{labels.get('method', '')} {labels.get('endpoint', '')}"
                metrics["in_progress"][key] = int(value)
                
            elif name == "python_info":
                metrics["python_info"] = {
                    "version": labels.get("version", "unknown"),
                    "implementation": labels.get("implementation", "unknown"),
                }
    
    return metrics


DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Misir Dashboard</title>
    <meta http-equiv="refresh" content="5">
    <style>
        :root {{
            --bg-dark: #0f0f0f;
            --bg-card: #1a1a1a;
            --bg-hover: #252525;
            --text-primary: #ffffff;
            --text-secondary: #888888;
            --accent-green: #00ff88;
            --accent-blue: #00aaff;
            --accent-orange: #ff8800;
            --accent-red: #ff4444;
            --border: #333333;
        }}
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: var(--bg-dark);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
        }}
        
        .header h1 {{
            font-size: 24px;
            font-weight: 600;
        }}
        
        .header h1 span {{
            color: var(--accent-green);
        }}
        
        .status-badge {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid var(--accent-green);
            border-radius: 20px;
            font-size: 14px;
        }}
        
        .status-dot {{
            width: 8px;
            height: 8px;
            background: var(--accent-green);
            border-radius: 50%;
            animation: pulse 2s infinite;
        }}
        
        @keyframes pulse {{
            0%, 100% {{ opacity: 1; }}
            50% {{ opacity: 0.5; }}
        }}
        
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        
        .card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
        }}
        
        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }}
        
        .card-title {{
            font-size: 14px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        
        .card-value {{
            font-size: 36px;
            font-weight: 700;
            color: var(--accent-green);
        }}
        
        .card-value.blue {{ color: var(--accent-blue); }}
        .card-value.orange {{ color: var(--accent-orange); }}
        
        .table-card {{
            grid-column: 1 / -1;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        
        th, td {{
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid var(--border);
        }}
        
        th {{
            color: var(--text-secondary);
            font-weight: 500;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        
        tr:hover td {{
            background: var(--bg-hover);
        }}
        
        .method {{
            font-family: monospace;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }}
        
        .method-get {{ background: rgba(0, 170, 255, 0.2); color: var(--accent-blue); }}
        .method-post {{ background: rgba(0, 255, 136, 0.2); color: var(--accent-green); }}
        .method-patch {{ background: rgba(255, 136, 0, 0.2); color: var(--accent-orange); }}
        .method-delete {{ background: rgba(255, 68, 68, 0.2); color: var(--accent-red); }}
        
        .endpoint {{
            font-family: monospace;
            color: var(--text-secondary);
        }}
        
        .status-pill {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            margin-right: 4px;
        }}
        
        .status-200 {{ background: rgba(0, 255, 136, 0.2); color: var(--accent-green); }}
        .status-404 {{ background: rgba(255, 136, 0, 0.2); color: var(--accent-orange); }}
        .status-500 {{ background: rgba(255, 68, 68, 0.2); color: var(--accent-red); }}
        
        .latency {{
            font-family: monospace;
        }}
        
        .latency-fast {{ color: var(--accent-green); }}
        .latency-medium {{ color: var(--accent-orange); }}
        .latency-slow {{ color: var(--accent-red); }}
        
        .footer {{
            text-align: center;
            color: var(--text-secondary);
            font-size: 12px;
            margin-top: 30px;
        }}
        
        .info-row {{
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
        }}
        
        .info-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: var(--text-secondary);
        }}
        
        .info-item strong {{
            color: var(--text-primary);
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Misir <span>Dashboard</span></h1>
        <div class="status-badge">
            <div class="status-dot"></div>
            <span>Online</span>
        </div>
    </div>
    
    <div class="info-row">
        <div class="info-item">
            <span>🐍</span>
            <span>Python <strong>{python_version}</strong></span>
        </div>
        <div class="info-item">
            <span>🕐</span>
            <span>Last updated: <strong>{timestamp}</strong></span>
        </div>
        <div class="info-item">
            <span>🔄</span>
            <span>Auto-refresh: <strong>5s</strong></span>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <div class="card-header">
                <span class="card-title">Total Requests</span>
            </div>
            <div class="card-value">{total_requests}</div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <span class="card-title">Unique Endpoints</span>
            </div>
            <div class="card-value blue">{unique_endpoints}</div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <span class="card-title">Avg Latency</span>
            </div>
            <div class="card-value orange">{avg_latency} ms</div>
        </div>
        
        <div class="card table-card">
            <div class="card-header">
                <span class="card-title">Request Log</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Method</th>
                        <th>Endpoint</th>
                        <th>Requests</th>
                        <th>Status Codes</th>
                        <th>Avg Latency</th>
                    </tr>
                </thead>
                <tbody>
                    {request_rows}
                </tbody>
            </table>
        </div>
    </div>
    
    <div class="footer">
        Misir Orientation Engine v1.0.0 — shiro.exe
    </div>
</body>
</html>
"""


def get_method_class(method: str) -> str:
    """Get CSS class for HTTP method."""
    return f"method-{method.lower()}"


def get_latency_class(ms: float) -> str:
    """Get CSS class for latency value."""
    if ms < 10:
        return "latency-fast"
    elif ms < 100:
        return "latency-medium"
    return "latency-slow"


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Internal metrics dashboard."""
    metrics = get_metrics_data()
    
    # Calculate totals
    total_requests = sum(v.get("total", 0) for v in metrics["requests"].values())
    unique_endpoints = len(metrics["requests"])
    
    # Calculate average latency
    total_time = sum(v.get("sum", 0) for v in metrics["latency"].values())
    total_count = sum(v.get("count", 0) for v in metrics["latency"].values())
    avg_latency = round((total_time / total_count) * 1000, 2) if total_count > 0 else 0
    
    # Build request rows
    rows = []
    for key, data in sorted(metrics["requests"].items(), key=lambda x: -x[1].get("total", 0)):
        parts = key.split(" ", 1)
        method = parts[0] if parts else "?"
        endpoint = parts[1] if len(parts) > 1 else key
        
        # Status pills
        status_pills = ""
        for status, count in sorted(data.get("by_status", {}).items()):
            status_class = f"status-{status[:1]}00" if status.isdigit() else "status-500"
            status_pills += f'<span class="status-pill {status_class}">{status}: {count}</span>'
        
        # Latency
        latency_data = metrics["latency"].get(key, {})
        latency_ms = latency_data.get("avg_ms", 0)
        latency_class = get_latency_class(latency_ms)
        
        row = f"""
        <tr>
            <td><span class="method {get_method_class(method)}">{method}</span></td>
            <td class="endpoint">{endpoint}</td>
            <td>{data.get('total', 0)}</td>
            <td>{status_pills}</td>
            <td class="latency {latency_class}">{latency_ms} ms</td>
        </tr>
        """
        rows.append(row)
    
    # Build HTML
    html = DASHBOARD_HTML.format(
        python_version=metrics["python_info"].get("version", "unknown"),
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total_requests=total_requests,
        unique_endpoints=unique_endpoints,
        avg_latency=avg_latency,
        request_rows="\n".join(rows) if rows else "<tr><td colspan='5' style='text-align:center;color:#888;'>No requests yet</td></tr>"
    )
    
    return HTMLResponse(content=html)


@router.get("/dashboard/api", tags=["Internal"])
async def dashboard_api():
    """JSON API for dashboard data (for custom UIs)."""
    return get_metrics_data()
