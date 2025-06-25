import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';

export interface HttpResponse {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
}

export interface HttpRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
}

/**
 * Lightweight HTTP client using Node.js built-in modules
 * Replaces axios to eliminate external dependencies
 */
export class HttpClient {
  private static instance: HttpClient;

  static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  async request(urlString: string, config: HttpRequestConfig = {}): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const {
        method = 'GET',
        headers = {},
        data,
        timeout = 10000
      } = config;

      const parsedUrl = new URL(urlString);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      // Prepare request data
      let requestData = '';
      if (data) {
        requestData = typeof data === 'string' ? data : JSON.stringify(data);
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        headers['Content-Length'] = Buffer.byteLength(requestData).toString();
      }

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers
      };

      const req = httpModule.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            let parsedData;
            try {
              parsedData = JSON.parse(responseData);
            } catch {
              parsedData = responseData;
            }

            const response: HttpResponse = {
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              data: parsedData,
              headers: res.headers as Record<string, string>
            };

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.setTimeout(timeout);

      if (requestData) {
        req.write(requestData);
      }

      req.end();
    });
  }

  async get(url: string, config: Omit<HttpRequestConfig, 'method'> = {}): Promise<HttpResponse> {
    return this.request(url, { ...config, method: 'GET' });
  }

  async post(url: string, data?: any, config: Omit<HttpRequestConfig, 'method' | 'data'> = {}): Promise<HttpResponse> {
    return this.request(url, { ...config, method: 'POST', data });
  }

  async put(url: string, data?: any, config: Omit<HttpRequestConfig, 'method' | 'data'> = {}): Promise<HttpResponse> {
    return this.request(url, { ...config, method: 'PUT', data });
  }

  async delete(url: string, config: Omit<HttpRequestConfig, 'method'> = {}): Promise<HttpResponse> {
    return this.request(url, { ...config, method: 'DELETE' });
  }
}

// Export a singleton instance
export const httpClient = HttpClient.getInstance();
