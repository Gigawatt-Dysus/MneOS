const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// In-memory state for tracking idle times
const vastIdleSince = {};

async function checkVast() {
    const VAST_API_KEY = process.env.VAST_API_KEY;
    if (!VAST_API_KEY) return;
    try {
        const res = await axios.get("https://console.vast.ai/api/v1/instances/", {
            headers: { "Accept": "application/json", "Authorization": `Bearer ${VAST_API_KEY}` }
        });
        const instances = res.data.instances || [];
        instances.forEach(inst => {
            if (inst.cur_state === 'running') {
                const gpuUtil = inst.gpu_util !== null ? inst.gpu_util : 0;
                const cpuUtil = inst.cpu_util !== null ? inst.cpu_util : 0;
                const isIdle = gpuUtil < 1.0 && cpuUtil < 2.0;
                
                if (isIdle) {
                    if (!vastIdleSince[inst.id]) {
                        vastIdleSince[inst.id] = Date.now();
                        console.log(`[Cloud Watchdog] ⚠️ Vast.ai instance ${inst.id} is IDLE. Monitoring for runaway billing...`);
                    } else if (Date.now() - vastIdleSince[inst.id] > 20 * 60 * 1000) { // 20 minutes
                        console.log(`[Cloud Watchdog] 🚨 Vast.ai instance ${inst.id} idle > 20 mins. TRIGGERING GUILLOTINE.`);
                        axios.delete(`https://console.vast.ai/api/v0/instances/${inst.id}/`, {
                            headers: { "Accept": "application/json", "Authorization": `Bearer ${VAST_API_KEY}` }
                        }).then(() => {
                            console.log(`[Cloud Watchdog] 💀 Vast.ai instance ${inst.id} TERMINATED.`);
                            delete vastIdleSince[inst.id];
                        }).catch(err => {
                            console.error(`[Cloud Watchdog] ❌ Failed to kill Vast instance ${inst.id}:`, err.message);
                        });
                    }
                } else {
                    if (vastIdleSince[inst.id]) {
                        console.log(`[Cloud Watchdog] ✅ Vast.ai instance ${inst.id} became active again. Idle timer reset.`);
                        delete vastIdleSince[inst.id];
                    }
                }
            } else {
                delete vastIdleSince[inst.id];
            }
        });
    } catch (e) {
        console.error('[Cloud Watchdog] Error checking Vast.ai:', e.message);
    }
}

async function checkRunPod() {
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    if (!RUNPOD_API_KEY) return;
    try {
        const query = `query { myself { pods { id desiredStatus runtime { uptimeInSeconds } } } }`;
        const res = await axios.post(`https://api.runpod.io/graphql?api_key=${RUNPOD_API_KEY}`, 
            { query }, { headers: { 'Content-Type': 'application/json' } }
        );
        const pods = res.data?.data?.myself?.pods || [];
        pods.forEach(pod => {
            if (pod.desiredStatus === 'RUNNING') {
                const hours = (pod.runtime?.uptimeInSeconds || 0) / 3600;
                if (hours > 2) { 
                    console.log(`[Cloud Watchdog] ⚠️ RunPod ${pod.id} has been running for ${hours.toFixed(1)} hours!`);
                }
            }
        });
    } catch (e) {
        console.error('[Cloud Watchdog] Error checking RunPod:', e.message);
    }
}

async function checkThunder() {
    const THUNDER_API_KEY = process.env.THUNDER_API_KEY;
    if (!THUNDER_API_KEY) return;
    try {
        const res = await axios.get("https://api.thundercompute.com:8443/v1/instances/list", {
            headers: { Authorization: `Bearer ${THUNDER_API_KEY}`, "Content-Type": "application/json" }
        });
        const instances = Object.values(res.data);
        instances.forEach(inst => {
            if (inst.status === "RUNNING") {
                console.log(`[Cloud Watchdog] ℹ️ Thunder Compute instance ${inst.uuid} is currently RUNNING.`);
            }
        });
    } catch (e) {
        console.error('[Cloud Watchdog] Error checking Thunder Compute:', e.message);
    }
}

async function runWatchdog() {
    console.log(`[Cloud Watchdog] 🔍 Sweeping cloud infrastructure for runaway nodes... (${new Date().toLocaleTimeString()})`);
    await checkVast();
    await checkRunPod();
    await checkThunder();
}

console.log('[Cloud Watchdog] 🛡️ Independent Cloud Billing Watchdog Online.');
runWatchdog();
setInterval(runWatchdog, 5 * 60 * 1000); // Check every 5 minutes
