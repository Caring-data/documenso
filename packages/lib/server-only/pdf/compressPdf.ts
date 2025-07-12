import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export async function compressPdfBuffer(
  pdfBuffer: Buffer,
  quality: 'high' | 'medium' | 'low' = 'medium',
): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputPath = join(tempDir, `${uuidv4()}.pdf`);
  const outputPath = join(tempDir, `${uuidv4()}-compressed.pdf`);

  const qualityMap = {
    high: '/printer',
    medium: '/ebook',
    low: '/screen',
  };

  await fs.writeFile(inputPath, new Uint8Array(pdfBuffer));

  const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${qualityMap[quality]} -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;

  await execAsync(command);

  const compressedBuffer = await fs.readFile(outputPath);

  await fs.unlink(inputPath);
  await fs.unlink(outputPath);

  return compressedBuffer;
}
