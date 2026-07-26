import os
import time
import datetime
from pymongo import MongoClient
from rich.live import Live
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.console import Console

MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017"
DB_NAME = "LifeOS"
COLLECTION_NAME = "cluster_telemetry"

console = Console()
fake_logs = [
    "SYSTEM: INITIATING SOVEREIGN HEARTBEAT PROTOCOL...",
    "DB: CONNECTED TO MONGODB ATLAS LOCAL (GGA)",
    "ROUTER: TAILSCALE TUNNEL ESTABLISHED"
]

def generate_hud(db):
    layout = Layout()
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="main"),
        Layout(name="logs", size=8)
    )
    layout["main"].split_row(
        Layout(name="left_panel", ratio=1),
        Layout(name="right_panel", ratio=2)
    )
    
    # Fetch Data
    nodes = list(db[COLLECTION_NAME].find().sort("node", 1))
    
    # --- HEADER ---
    header_text = Text("PROJECT GIGI: MNEOS // SOVEREIGN CORE  ●  GENESIS CLUSTER ACTIVE", style="bold bright_green", justify="center")
    layout["header"].update(Panel(header_text, style="green"))
    
    # --- CLUSTER OVERVIEW ---
    total_cpu = 0
    total_ram = 0
    total_ram_used = 0
    active_nodes = 0
    now = datetime.datetime.utcnow()
    
    for n in nodes:
        last_seen = n.get("last_seen", datetime.datetime.min)
        if (now - last_seen).total_seconds() < 15: # 15 sec TTL
            active_nodes += 1
            total_cpu += n.get("cpu_percent", 0)
            total_ram += n.get("ram_total_gb", 0)
            total_ram_used += n.get("ram_used_gb", 0)
            
    avg_cpu = round(total_cpu / max(1, active_nodes), 1) if active_nodes > 0 else 0
    ram_usage = round((total_ram_used / max(1, total_ram)) * 100, 1) if total_ram else 0
    
    status_text = f"CLUSTER METRICS\n\nACTIVE NODES:  {active_nodes}\nAVG CLUSTER CPU:  {avg_cpu}%\nCLUSTER RAM USAGE: {ram_usage}%\n\nLAST REFRESH: {datetime.datetime.now().strftime('%H:%M:%S')}\nNETWORK: TAILSCALE (SECURE)"
    layout["left_panel"].update(Panel(Text(status_text, style="bold bright_green"), title="[bright_green]OVERVIEW", border_style="green"))
    
    # --- NODE GRID ---
    table = Table(expand=True, border_style="green", header_style="bold bright_green")
    table.add_column("NODE")
    table.add_column("STATUS")
    table.add_column("UPTIME")
    table.add_column("CPU")
    table.add_column("RAM")
    
    if len(nodes) == 0:
        table.add_row("[dim]Awaiting telemetry...[/]", "-", "-", "-", "-")
    
    for n in nodes:
        node_name = n.get("node", "UNKNOWN")
        last_seen = n.get("last_seen", datetime.datetime.min)
        is_active = (now - last_seen).total_seconds() < 15
        
        if is_active:
            status = "[bold bright_green]● ONLINE[/]"
            uptime = f"{n.get('uptime_hours', 0)}h"
            cpu = f"{n.get('cpu_percent', 0)}%"
            ram = f"{n.get('ram_used_gb', 0)} / {n.get('ram_total_gb', 0)} GB"
            
            # Simulated trigger warnings for active nodes
            if n.get("cpu_percent", 0) > 85:
                fake_logs.append(f"{node_name}: HIGH CPU LOAD WARNING ({cpu})")
        else:
            status = "[bold red]○ OFFLINE[/]"
            uptime = "-"
            cpu = "-"
            ram = "-"
            
        table.add_row(
            f"[bold bright_green]{node_name}[/]", 
            status, 
            f"[bright_green]{uptime}[/]", 
            f"[bright_green]{cpu}[/]", 
            f"[bright_green]{ram}[/]"
        )
        
    layout["right_panel"].update(Panel(table, title="[bright_green]NODE GRID", border_style="green"))
    
    # --- SYSTEM LOG ---
    while len(fake_logs) > 5:
        fake_logs.pop(0)
    
    log_text = "\n".join([f"> {log}" for log in fake_logs])
    layout["logs"].update(Panel(Text(log_text, style="bright_green"), title="[bright_green]SYSTEM LOG", border_style="green"))
    
    return layout

def main():
    os.system("title MneOS Sovereign HUD & color 0a")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    db = client[DB_NAME]
    
    try:
        # Check connection
        client.admin.command('ping')
        fake_logs.append("DB: PING SUCCESS. SYNCING TELEMETRY...")
    except Exception as e:
        print(f"Database connection failed: {e}")
        time.sleep(5)
        return

    with Live(generate_hud(db), refresh_per_second=2, screen=True) as live:
        while True:
            time.sleep(0.5)
            live.update(generate_hud(db))

if __name__ == "__main__":
    main()
