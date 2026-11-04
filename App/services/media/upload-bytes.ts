/** Other platforms retain their existing upload transport. */
export async function readUploadBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}
