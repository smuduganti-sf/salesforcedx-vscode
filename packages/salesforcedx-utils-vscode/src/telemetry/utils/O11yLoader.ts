/**
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/

/* eslint-disable header/header */
/* eslint-disable prefer-arrow/prefer-arrow-functions */
/* eslint-disable @typescript-eslint/no-restricted-types */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

let cachedModules: Promise<{
  o11yClientVersion: string;
  getInstrumentation: Function;
  o11ySchemaVersion: string;
  registerInstrumentedApp: any;
  ConsoleCollector: any;
  a4d_instrumentation: any;
}> | null = null;

export async function loadO11yModules() {
  if (!cachedModules) {
    cachedModules = (async () => {
      const [o11yClient, o11ySchema, a4dInstrumentationModule] = await Promise.all([
        import('o11y/client'),
        import('o11y_schema/version'),
        import('o11y_schema/sf_a4dInstrumentation')
      ]);

      const { registerInstrumentedApp, ConsoleCollector, _version: o11yClientVersion, getInstrumentation } = o11yClient;
      const { version: o11ySchemaVersion } = o11ySchema;

      return {
        o11yClientVersion,
        getInstrumentation,
        o11ySchemaVersion,
        registerInstrumentedApp,
        ConsoleCollector,
        a4d_instrumentation: a4dInstrumentationModule.a4dInstrumentationSchema
      };
    })();
  }
  return cachedModules;
}
