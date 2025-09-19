import * as vscode from 'vscode';
import { httpClient } from '../utils/httpClient';
import { getAccessToken } from '../utils/tokenStorage';

const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2';

/**
 * Optional: Webhook helper to support real-time updates.
 * NOTE: In a distributable extension, hosting a public endpoint is required.
 * This module is provided as an opt-in stub and is not enabled by default.
 */
export class ClickUpWebhooksService {
  constructor(private context: vscode.ExtensionContext) {}

  private async authHeaders() {
    const token = await getAccessToken(this.context);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  /**
   * Create a webhook. Requires a publicly reachable endpoint (e.g., your serverless function).
   */
  async createWebhook(teamId: string, endpoint: string, events: string[] = ['taskCreated','taskUpdated']): Promise<any | null> {
    try {
      const res = await httpClient.post(`${CLICKUP_API_BASE_URL}/team/${teamId}/webhook`, {
        endpoint,
        events,
        status: 'active',
      }, { headers: await this.authHeaders(), timeout: 20000 });
      return res.data;
    } catch (e) {
      console.warn('ClickUp webhook creation failed:', e);
      return null;
    }
  }

  async listWebhooks(teamId: string): Promise<any[]> {
    try {
      const res = await httpClient.get(`${CLICKUP_API_BASE_URL}/team/${teamId}/webhook`, { headers: await this.authHeaders() });
      const data = res.data;
      return Array.isArray(data?.webhooks) ? data.webhooks : [];
    } catch (e) {
      console.warn('ClickUp list webhooks failed:', e);
      return [];
    }
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    try {
      await httpClient.delete(`${CLICKUP_API_BASE_URL}/webhook/${webhookId}`, { headers: await this.authHeaders() });
      return true;
    } catch (e) {
      console.warn('ClickUp delete webhook failed:', e);
      return false;
    }
  }
}
