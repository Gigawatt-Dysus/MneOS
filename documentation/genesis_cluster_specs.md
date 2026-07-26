# Genesis Cluster Topology & Hardware Specifications

## Datacenter Specs:
* **Location:** Central Florida (Davenport/Route 27 corridor)
* **LAN:** 100GB/s wired Ethernet
* **Internet:** 1 GB/s Fiber Optic via Summit Broadband 

---

## Node 0: Gigi-Genesis-Prime (GGP) 'aka 'Victus'
- **Role:** Primary Development Rig - Laptop
- **Device name:** MneOS-Prime (Formerly Eric-Gaming aka Victus)
- **Processor:** AMD Ryzen 5 7640HS w/ Radeon 760M Graphics (4.30 GHz)
- **Installed RAM:** 64.0 GB (61.8 GB usable)
- **Graphics card 1:** NVIDIA GeForce RTX 3050 6GB Laptop GPU (6 GB)
- **Graphics card 2:** AMD Radeon(TM) Graphics (2 GB)
- **Local Storage:** 448 GB of 477 GB used
- **Device ID:** 07EB3CA4-2CB8-4388-A149-AFE1FAC1A2FD
- **Product ID:** 00342-22317-49165-AAOEM
- **System type:** 64-bit operating system, x64-based processor
- **OS:** Windows 11 Pro, Version 25H2 (OS Build 26200.8655)
- **Notes:** Since this is a laptop, it is not attached to LAN persistently - when used remotely, it connects via T-Mobile Hotspot (5G/Data Limited)

---

## Node 1: Gigi-Genesis-Alpha (GGA)
- **Role:** Primary Master, Docker Host (MongoDB), Mechanical Drive Host (`F:\`)
- **Device name:** Gigi-Genesis-Alpha
- **Processor:** Intel(R) Core(TM) Ultra 5 235T (2.20 GHz)
- **Installed RAM:** 16.0 GB (15.5 GB usable)
- **Graphics Card:** Intel(R) Graphics (128 MB)
- **Storage:** 128 GB of 238 GB used
- **Device ID:** 737A2C34-A3C8-459E-86C2-A40766253B70
- **Product ID:** 00355-63592-03796-AAOEM
- **System Type:** 64-bit operating system, x64-based processor
- **OS:** Windows 11 Pro, Version 25H2 (OS Build 26200.8655)
- **Notes:** Headless. Runs Docker MongoDB. Host for the `F:\` mechanical lifeboat drive. Due to Docker and 16GB RAM, Alpha cannot run heavy AI work.

---

## Node 2: Gigi-Genesis-Beta (GGB)
- **Role:** Distributed Inference Node (CPU)
- **Device name:** Gigi-Genesis-Beta
- **Manufacturer/Model:** 2019 Lenovo ThinkCentre
- **Processor:** Intel(R) Core(TM) i3-6100 CPU @ 3.70GHz
- **Installed RAM:** 16.0 GB
- **Graphics Card:** Intel(R) HD Graphics 530
- **Storage:** 104 GB of 238 GB used
- **Device ID:** 9724A3A7-7C0E-4DE6-9FFD-82E6FB352FE4
- **Product ID:** 00330-51525-20992-AAOEM
- **System Type:** 64-bit operating system, x64-based processor
- **OS:** Windows 11 Pro, Version 23H2 (OS Build 22631.6199)
- **Notes:** Headless. Runs Docker Backup MongoDB. Needs to be provisioned/configured for this role.

---

## Node 3: Gigi-Genesis-Gamma (GGG)
- **Role:** Distributed Inference Node (CPU)
- **Device name:** Gigi-Genesis-Gamma
- **Manufacturer/Model:** 2019 Lenovo ThinkCentre
- **Processor:** Intel(R) Core(TM) i3-6100 CPU @ 3.70GHz
- **Installed RAM:** 8.00 GB
- **Graphics Card:** Intel(R) HD Graphics 530
- **Device ID:** 09DA9C6B-0242-4921-BEA2-14CD3FE521F1
- **Product ID:** 00330-51525-20937-AAOEM
- **System Type:** 64-bit operating system, x64-based processor
- **OS:** Windows 11 Pro, Version 23H2 (OS Build 22631.6199)
- **Notes:** Headless.

---

## Node 4: Gigi-Genesis-Delta (GGD)
- **Role:** Part-Time Shadow Node (Vision / Utility Inference)
- **Device name:** DESKTOP-9IB82M5 (Wyatt's Laptop)
- **Processor:** AMD Ryzen 7 5800H with Radeon Graphics (3.20 GHz)
- **Installed RAM:** 16.0 GB (15.4 GB usable)
- **Graphics Card:** NVIDIA GeForce RTX 3050 Ti Laptop GPU (4 GB)
- **Storage:** 477 GB SSD (75 GB free)
- **Device ID:** C61AFC8A-EF99-46A1-8CC7-D01F99E8178A
- **System Type:** 64-bit operating system, x64-based processor
- **Notes:** "Timeshare" node. Connects via OpenSSH Server over Tailscale to create an invisible background console. PM2 is used to manage Node.js swarm scripts and Ollama to ensure zero visual footprint or interruption to the local user's gaming schedule.

---

## Node 5: Gigi-Genesis-Epsilon (GGE)
- **Role:** Pure CPU / Fileserver (Pending Wipe & Rebuild)
- **Device name:** Gigi-Genesis-Epsilon
- **Manufacturer/Model:** HP EliteDesk 800 G4 35W Desktop Mini PC (TPC-Q050-DM)
- **Processor:** Intel Core i5-8500T (from spec string i58500T)
- **Installed RAM:** 8.00 GB
- **Storage:** 256 GB SSD
- **OS:** Windows 11 Pro (Upgraded from original Win 10 Pro)
- **Network:** Gigabit Ethernet / Intel Wireless 9560NGW
- **Serial No:** MXL9434KB7
- **Notes:** Currently in possession. Requires a complete format and "burn to the ground" OS re-installation to purge corporate restraining bolts from its former owners before integration into the cluster.

---

## Node 6: Gigi-Genesis-Zeta (GGZ)
- **Role:** FUTURE EXPANSION DUAL GPU LOCAL AI SERVER
- **Device name:** Gigi-Genesis-Zeta
