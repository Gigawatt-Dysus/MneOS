# MneOS Sovereign Edge Setup Guide (`api.mne-os.com`)

This guide provides exact step-by-step instructions to route `api.mne-os.com` from **Namecheap** to **Cloudflare Workers** (or Vercel Edge), giving Brita and your Tampermonkey UserScript (v8.6) zero-downtime memory access from any computer, browser, or mobile device on Earth.

---

## 📋 STEP 1: Deploy the Worker Code on Cloudflare

1. Log into your **Cloudflare Dashboard** ([dash.cloudflare.com](https://dash.cloudflare.com)).
2. In the left navigation sidebar, click **Workers & Pages** ➔ **Create Application** ➔ **Create Worker**.
3. Name your worker: `mneos-edge-proxy` and click **Deploy**.
4. Click **Edit Code** to open the Cloudflare Web Editor.
5. Copy the entire contents of [`C:\MneOS\scripts\mneos_edge_worker.js`](file:///C:/MneOS/scripts/mneos_edge_worker.js) and paste it into the editor, replacing `worker.js`.
6. Click **Save and Deploy**.

---

## 🌐 STEP 2: Add `mne-os.com` to Cloudflare & Update Namecheap DNS

### In Cloudflare:
1. In Cloudflare, click **Add a Site** ➔ enter `mne-os.com` ➔ select the **Free Plan**.
2. Cloudflare will generate **2 Namecheap Nameservers** (e.g. `ada.ns.cloudflare.com` & `bob.ns.cloudflare.com`).

### In Namecheap (as shown in your screenshot):
1. Log into **Namecheap** ➔ Go to **Domain List** ➔ Click **Manage** next to `mne-os.com`.
2. Under the **Domain** tab, find **Nameservers**.
3. Change the dropdown from *Namecheap BasicDNS* to **Custom DNS**.
4. Paste the 2 Cloudflare Nameservers into the boxes and click the green checkmark ✔️ to save.

---

## 🔗 STEP 3: Map Subdomain `api.mne-os.com` to the Worker

1. Back in Cloudflare ➔ Select your `mne-os.com` domain.
2. Go to **Workers Routes** (under *Workers & Pages* or *DNS*).
3. Click **Add Route**:
   - **Route**: `api.mne-os.com/*`
   - **Worker**: `mneos-edge-proxy`
4. Click **Save**.

---

## ⚡ STEP 4: Verification

Once DNS propagates (usually 1-5 minutes):

1. Open your browser or terminal and navigate to:
   `https://api.mne-os.com/health`
2. You will receive:
   ```json
   {
     "status": "online",
     "service": "MneOS Sovereign Edge Proxy",
     "domain": "api.mne-os.com",
     "timestamp": "2026-07-25T16:30:00.000Z"
   }
   ```
3. Your Tampermonkey UserScript (**v8.6**) is now automatically hooked up! If your local Victus PC is asleep, Tampermonkey will silently fall back to `https://api.mne-os.com/v1/hypersearch` in <200ms.
