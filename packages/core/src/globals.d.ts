// TextEncoder exists in every runtime we target (Node 18+, Workers,
// browsers) but is absent from the pure ES2022 lib. Declared minimally here
// so this package stays free of the full DOM lib.
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
