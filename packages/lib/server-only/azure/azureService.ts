import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

export class AzureService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

    if (!this.containerName) {
      throw new Error('AZURE_STORAGE_CONTAINER_NAME environment variable is required');
    }

    if (connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    } else {
      const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
      const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

      if (!accountName || !accountKey) {
        throw new Error(
          'Azure Storage credentials are not configured properly. Provide either AZURE_STORAGE_CONNECTION_STRING or both AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY',
        );
      }

      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      this.blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential,
      );
    }
  }

  /**
   * Extract MIME type from base64 data URL
   * @param base64String Base64 string with data URL
   * @returns string | null - MIME type or null
   */
  private extractMimeTypeFromBase64(base64String: string): string | undefined {
    const mimeMatch = base64String.match(/^data:([^;]+);base64,/);
    return mimeMatch ? mimeMatch[1] : undefined;
  }

  /**
   * Get MIME type based on file extension
   * @param extension File extension
   * @returns string | null - MIME type or null
   */
  private getMimeType(extension: string): string {
    return MIME_TYPES[extension.toLowerCase()] || 'application/octet-stream';
  }

  private generateUniqueFileName(fileName: string): string {
    const fileExtension = fileName.split('.').pop() || '';
    return `${uuidv4()}.${fileExtension}`;
  }

  private buildBlobPath(fileName: string, folder?: string): string {
    const uniqueFileName = this.generateUniqueFileName(fileName);
    return folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
  }

  /**
   * Store file in Azure Blob Storage
   * @param file (File or Buffer)
   * @param fileName Name of the file with extension
   * @param folder Optional folder path
   * @returns Promise<string> - URL of the uploaded file
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    folder?: string,
    mimeType?: string,
  ): Promise<string> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);

      // Create container if it doesn't exist
      await containerClient.createIfNotExists();

      const blobPath = this.buildBlobPath(fileName, folder);
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

      const fileExtension = fileName.split('.').pop() || '';
      const contentType = mimeType || this.getMimeType(fileExtension);

      const uploadResponse = await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      });

      console.log(`File uploaded successfully. RequestId: ${uploadResponse.requestId}`);

      return blockBlobClient.url;
    } catch (error) {
      console.error('Error uploading file to Azure Blob Storage:', error);
      throw new Error(`Error uploading file to Azure Blob Storage: ${error}`);
    }
  }

  /**
   * Upload base64 encoded file to Azure Blob Storage
   * @param base64String Base64 encoded string
   * @param fileName Name of the file with extension
   * @param folder Optional folder path
   * @returns Promise<string> - URL of the uploaded file
   */
  async uploadBase64(base64String: string, fileName: string, folder?: string): Promise<string> {
    try {
      const buffer = this.base64ToBuffer(base64String);
      const mimeType = this.extractMimeTypeFromBase64(base64String);

      return await this.uploadFile(buffer, fileName, folder, mimeType);
    } catch (error) {
      console.error('Error uploading base64 file to Azure Blob Storage:', error);
      throw new Error(`Error uploading base64 file to Azure Blob Storage: ${error}`);
    }
  }

  /**
   * Convert base64 string to Buffer
   * @param base64String Base64 encoded string
   * @returns Buffer
   */
  private base64ToBuffer(base64String: string): Buffer {
    try {
      // Remove data URL prefix if it exists
      const base64Data = base64String.replace(/^data:[^;]+;base64,/, '');
      return Buffer.from(base64Data, 'base64');
    } catch (error) {
      console.error('Error converting base64 to buffer:', error);
      throw new Error(`Error converting base64 to buffer: ${error}`);
    }
  }
}

/**
 * Convert buffer to base64 string
 * @param buffer Buffer to convert
 * @param mimeType Optional MIME type for data URL
 * @returns string - Base64 string
 */
export function bufferToBase64(buffer: Buffer, mimeType?: string): string {
  try {
    const base64 = buffer.toString('base64');
    return mimeType ? `data:${mimeType};base64,${base64}` : base64;
  } catch (error) {
    console.error('Error converting buffer to base64:', error);
    throw new Error(`Error converting buffer to base64: ${error}`);
  }
}
