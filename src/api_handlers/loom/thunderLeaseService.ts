import axios from "axios";

/**
 * Thunder Compute Provisioning Engine
 * API Base: https://api.thundercompute.com:8443/v1
 */

const THUNDER_BASE_URL = "https://api.thundercompute.com:8443/v1";

interface ThunderCreateRequest {
  cpu_cores: number;
  disk_size_gb: number;
  ephemeral_disk_gb?: number;
  gpu_type: string;
  num_gpus: number;
  template: string;
  public_key?: string;
  mode?: "prototyping" | "production";
}

export const thunderLeaseService = {
  /**
   * Discovers available GPU inventory and current pricing.
   */
  async getMarketInventory(apiKey: string) {
    try {
      // Thunder has a few endpoints, we'll try to fetch GPU specs/pricing
      const response = await axios.get(`${THUNDER_BASE_URL}/pricing`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      return response.data;
    } catch (error) {
      console.error("[Thunder] Failed to fetch market inventory:", error);
      throw error;
    }
  },

  /**
   * Ignites a new ephemeral GPU instance on Thunder Compute.
   */
  async igniteForge(apiKey: string, gpuType: string, publicKey: string) {
    const payload: ThunderCreateRequest = {
      cpu_cores: 8,
      disk_size_gb: 150, // 150GB persistent storage for MegaForge
      gpu_type: gpuType,
      num_gpus: 1,
      template: "ubuntu-22.04", // Standard template, we'll run onstart.sh
      public_key: publicKey,
      mode: "prototyping"
    };

    try {
      const response = await axios.post(`${THUNDER_BASE_URL}/instances/create`, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      return response.data;
    } catch (error) {
      console.error("[Thunder] Forge Ignition Failed:", error);
      throw error;
    }
  },

  /**
   * Retrieves active instances for heartbeat and status monitoring.
   */
  async getActiveInstances(apiKey: string) {
    try {
      const response = await axios.get(`${THUNDER_BASE_URL}/instances/list`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      return response.data;
    } catch (error) {
      console.error("[Thunder] Failed to fetch instances:", error);
      throw error;
    }
  },

  /**
   * The Guillotine - Terminates an instance to stop billing.
   */
  async guillotine(apiKey: string, instanceId: string) {
    try {
      const response = await axios.post(
        `${THUNDER_BASE_URL}/instances/${instanceId}/delete`,
        {},
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("[Thunder] Guillotine Failed:", error);
      throw error;
    }
  }
};
