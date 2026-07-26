# Architectural Directive: MneOS Workplace Shell Implementation
## Sub-system: Graphical User Interface (GUI) / Window Management

**Author/Architect:** Eric Cornett

**Directive:** Permanent architectural specification and logging.

**Subject:** Transition to a Literal Web Desktop Environment – The MneOS Workplace Shell

Following a collaborative design review with Zen, we are formalizing the UI/UX foundation for MneOS.

Moving entirely away from rigid DOM constraints (such as static left/right panel layouts), MneOS will literally be implemented as a graphical Desktop Environment. This serves as a modern reincarnation of the classic OS/2 Warp Workplace Shell, adapted for the web via React and Vite, supported by our sovereign database infrastructure.

### 1. The Core Architectural Components

**The Workplace Shell (Fluid Canvas):** 
The application window functions as a literal desktop canvas. There are no static panels. The background can dynamically render living, data-driven views (such as the MatrixGrid running as live, animated desktop wallpaper) or even a Timeslide version of the classic randomly rotating wallpaper fed by the user's own life Matrix. *(Note: This dynamic wallpaper must include constraints for what collections to pull from—we do not want screenshots of spreadsheets, receipts for tax purposes, or private 'your eyes only' type collections popping up as desktop wallpaper).*

**The Window Manager (`react-rnd`):** 
All primary modules (the Composer, Triage Modal, Event Viewer, etc.) become fully draggable, resizable, and self-contained windows. We will implement a standard global `WindowManagerContext` utilizing `react-rnd` (or equivalent) to manage z-index stacking context. Windows can be moved, minimized, maximized, or tiled at the user's discretion to reduce UI friction and adapt to any screen footprint.

**The Dock / Taskbar:** 
The legacy vertical sidebar is formally deprecated. It is replaced by a sleek, glassmorphic taskbar/dock positioned at the screen edge (bottom or macOS-style). This dock hosts a central "Start" menu (Springboard), active open window indicators, and an interactive system tray displaying real-time Swarm telemetry, connection status, and system time.

**Widgets & Desktop Icons:** 
The environment supports persistent interactive shortcuts and widgets placed directly on the canvas (e.g., a file shortcut for backlogged media, a live widget for the Shoebox Ticker, or access points for the Black Box Recorder).

### 2. Execution Mandate for Zen (and future devs)
Build the system to be highly responsive, stateful, and zero-trust. The application must look, feel, and respond exactly like a standalone desktop operating system for personal sovereignty and history management.
