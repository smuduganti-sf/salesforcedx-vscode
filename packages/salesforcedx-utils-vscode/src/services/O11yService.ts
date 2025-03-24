/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import axios from 'axios';
import { loadO11yModules } from '../telemetry/utils/O11yLoader';

export class O11yService {
  O11Y_UPLOAD_THRESHOLD_BYTES = 50000;
  o11yUploadEndpoint: string | undefined;
  instrumentation: any;
  _instrApp: any;
  protoEncoderFunc: any;
  o11y: any;
  o11yClient: any;
  o11ySchema: any;
  a4dO11ySchema: any;
  readonly environment: Record<string, string> = {};
  private o11yModules: Awaited<ReturnType<typeof loadO11yModules>> | null = null;
  private static instance: O11yService | null = null;

  private constructor() {}

  public static getInstance(): O11yService {
    if (!O11yService.instance) {
      const instance = new O11yService();
      O11yService.instance = instance;
    }
    return O11yService.instance;
  }

  async initialize(extensionName: string, o11yUploadEndpoint: string) {
    this.o11yUploadEndpoint = o11yUploadEndpoint;
    // Ensure modules are loaded before using them
    this.o11yModules = await loadO11yModules();

    const { o11yClientVersion, getInstrumentation, registerInstrumentedApp, ConsoleCollector } = this.o11yModules;
    const { o11ySchemaVersion, a4d_instrumentation } = this.o11yModules;

    this.instrumentation = getInstrumentation(extensionName + '-instrumentation');
    this.a4dO11ySchema = a4d_instrumentation;

    Object.assign(this.environment, {
      appName: extensionName + '-extension',
      o11ySchemaVersion,
      appExperience: 'Sample',
      deviceId: 'Unknown',
      deviceModel: 'Unknown',
      sdkVersion: `${o11yClientVersion}:${o11ySchemaVersion}`
    });

    // Use `registerInstrumentedApp` if needed
    // STEP 1: Register the app
    this._instrApp = registerInstrumentedApp(extensionName + '-extension', {
      isProduction: false,
      enableBuffering: true
    });

    // STEP 2: Register log collectors
    this._instrApp.registerLogCollector(new ConsoleCollector());

    // STEP 3: Register a metrics collector
    this._instrApp.simpleCollector = await this.initSimpleCollector(this._instrApp, {
      appName: this.environment.appName,
      sdkVersion: this.environment.sdkVersion
    });
  }

  private getEndHRTime(hrstart: [number, number]): number {
    const hrend = process.hrtime(hrstart);
    const elapsedMilliseconds = hrend[0] * 1000 + hrend[1] / 1e6;
    return elapsedMilliseconds;
  }

  public logEvent(properties?: { [key: string]: any }): void {
    if (this.instrumentation) {
      this.instrumentation.log(this.a4dO11ySchema, {
        message: JSON.stringify(properties)
      });
    } else {
      console.log('O11yService: Unable to log event - Instrumentation not initialized.');
    }
  }

  async upload(): Promise<void> {
    // Log anything that was buffered
    await this.uploadAsNeededAsync(true);
  }

  async initSimpleCollector(o11yApp: any, environment: any): Promise<any> {
    const [simpleCollectorModule, collectorsModule] = await Promise.all([
      import('o11y/simple_collector'),
      import('o11y/collectors')
    ]);

    this.protoEncoderFunc = (collectorsModule.default || collectorsModule).encodeCoreEnvelopeContentsRaw;

    const simpleCollector = new (simpleCollectorModule.default || simpleCollectorModule).SimpleCollector({
      environment
    });

    o11yApp.registerLogCollector(simpleCollector, { retroactive: true });
    o11yApp.registerMetricsCollector(simpleCollector);
    return simpleCollector;
  }

  uploadAsNeededAsync(ignoreThreshold = false): Promise<PromiseSettledResult<Response>[]> {
    const promises: Promise<Response>[] = [];

    const simpleCollector = this._instrApp.simpleCollector;
    if (
      simpleCollector?.hasData &&
      (ignoreThreshold || simpleCollector.estimatedByteSize >= this.O11Y_UPLOAD_THRESHOLD_BYTES)
    ) {
      const rawContents = simpleCollector.getRawContentsOfCoreEnvelope();
      const binary = this.protoEncoderFunc(rawContents);
      promises.push(this.uploadToFalconAsync(binary));
    }

    return Promise.allSettled(promises);
  }

  async uploadToFalconAsync(binary: Uint8Array): Promise<Response> {
    const b64 = Buffer.from(binary).toString('base64');

    if (!this.o11yUploadEndpoint) {
      throw new Error('ccUploadEndpoint is not defined');
    }

    return this.postRequest(this.o11yUploadEndpoint, { base64Env: b64 }) as Promise<Response>;
  }

  async postRequest(endpoint: string, body: any): Promise<any> {
    try {
      const response = await axios.post(endpoint, body, {
        headers: { 'Content-Type': 'application/json' }
      });

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Failed to post request:', error.message);
        if (error.response) {
          console.error(`Error Response Status: ${error.response.status}`);
        }
      } else {
        console.error('Unknown error:', error);
      }
      throw error;
    }
  }
}
