declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  }
  type PdfParse = (
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>
  ) => Promise<PdfParseResult>;
  const pdfParse: PdfParse;
  export default pdfParse;
}
