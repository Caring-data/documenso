import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

export class AzureService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;
  constructor() {
    // Option 1: Using connection string (recommended)
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;
    console.log('connectionString', connectionString);
    if (connectionString) {
      // Use connection string if available
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    } else {
      // Fallback to account name and key
      const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
      const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
      if (!accountName || !accountKey) {
        throw new Error('Azure Storage credentials are not configured properly');
      }
      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      this.blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential,
      );
    }
    if (!this.containerName) {
      throw new Error('Azure Storage container name is not configured');
    }
  }

  /**
   * Extract MIME type from base64 data URL
   * @param base64String Base64 string with data URL
   * @returns string | null - MIME type or null
   */
  private extractMimeTypeFromBase64(base64String: string): string | null {
    const mimeMatch = base64String.match(/^data:([^;]+);base64,/);
    return mimeMatch ? mimeMatch[1] : null;
  }

  /**
   * Get MIME type based on file extension
   * @param extension File extension
   * @returns string | null - MIME type or null
   */
  private getMimeType(extension: string): string | null {
    const mimeTypes: { [key: string]: string } = {
      pdf: 'application/pdf',
    };

    return mimeTypes[extension.toLowerCase()] || null;
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

      const fileExtension = fileName.split('.').pop() || '';
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const blobName = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const uploadResponse = await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType:
            mimeType || this.getMimeType(fileExtension) || 'application/octet-stream',
        },
      });

      console.log('File uploaded successfully:', uploadResponse.requestId);
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
      const buffer = base64ToBuffer(base64String);
      const mimeType = this.extractMimeTypeFromBase64(base64String);
      return await this.uploadFile(buffer, fileName, folder, mimeType);
    } catch (error) {
      console.error('Error uploading base64 file to Azure Blob Storage:', error);
      throw new Error(`Error uploading base64 file to Azure Blob Storage: ${error}`);
    }
  }

  /**
   * Upload buffer directly to Azure Blob Storage (alias for uploadFile)
   * @param buffer Buffer data
   * @param fileName Name of the file with extension
   * @param folder Optional folder path
   * @param mimeType Optional MIME type
   * @returns Promise<string> - URL of the uploaded file
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    folder?: string,
    mimeType?: string,
  ): Promise<string> {
    return this.uploadFile(buffer, fileName, folder, mimeType);
  }
}

/**
 * Convert base64 string to Buffer
 * @param base64String Base64 encoded string
 * @returns Buffer
 */
export function base64ToBuffer(base64String: string): Buffer {
  try {
    // Remove data URL prefix if it exists
    const base64Data = base64String.replace(/^data:[^;]+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  } catch (error) {
    console.error('Error converting base64 to buffer:', error);
    throw new Error(`Error converting base64 to buffer: ${error}`);
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
