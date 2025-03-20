declare module 'o11y_schema/version' {
  export const version: string;
}

declare module 'o11y_schema/sf_a4dInstrumentation' {
  export const a4dInstrumentationSchema: unknown;
}

declare module 'o11y/collectors';
declare module 'o11y/simple_collector';
type ProtoEncoderFuncType = (input: unknown) => unknown;
