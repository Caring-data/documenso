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
   * Store file in Azure Blob Storage
   * @param file (File or Buffer)
   * @param fileName Name of the file with extension
   * @param folder Optional folder path
   * @returns Promise<string> - URL of the uploaded file
   */
  async uploadFile(file: File | Buffer, fileName: string, folder?: string): Promise<string> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      // Create container if it doesn't exist (without public access)
      await containerClient.createIfNotExists();
      const fileExtension = fileName.split('.').pop() || '';
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const blobName = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      let uploadResponse;
      if (file instanceof File) {
        const buffer = await file.arrayBuffer();
        uploadResponse = await blockBlobClient.uploadData(new Uint8Array(buffer), {
          blobHTTPHeaders: {
            blobContentType: file.type || 'application/octet-stream',
          },
        });
      } else {
        uploadResponse = await blockBlobClient.uploadData(file, {
          blobHTTPHeaders: {
            blobContentType: 'application/octet-stream',
          },
        });
      }
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
      const file = base64ToBuffer(base64String);
      return await this.uploadFile(file, fileName, folder);
    } catch (error) {
      console.error('Error uploading base64 file to Azure Blob Storage:', error);
      throw new Error(`Error uploading base64 file to Azure Blob Storage: ${error}`);
    }
  }
  /**
   * Upload buffer directly to Azure Blob Storage
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
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists();
      const fileExtension = fileName.split('.').pop() || '';
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const blobName = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const uploadResponse = await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: mimeType || 'application/octet-stream',
        },
      });
      console.log('Buffer uploaded successfully:', uploadResponse.requestId);
      return blockBlobClient.url;
    } catch (error) {
      console.error('Error uploading buffer to Azure Blob Storage:', error);
      throw new Error(`Error uploading buffer to Azure Blob Storage: ${error}`);
    }
  }
  /**
   * Delete a file from Azure Blob Storage
   * @param blobName Name of the blob to delete
   * @returns Promise<boolean> - True if deleted successfully
   */
  async deleteFile(blobName: string): Promise<boolean> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const deleteResponse = await blockBlobClient.deleteIfExists();
      console.log('File deleted successfully:', deleteResponse.succeeded);
      return deleteResponse.succeeded;
    } catch (error) {
      console.error('Error deleting file from Azure Blob Storage:', error);
      throw new Error(`Error deleting file from Azure Blob Storage: ${error}`);
    }
  }
  /**
   * Get file URL from Azure Blob Storage
   * @param blobName Name of the blob
   * @returns string - URL of the file
   */
  getFileUrl(blobName: string): string {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    return blockBlobClient.url;
  }
  /**
   * List all files in the container
   * @param prefix Optional prefix to filter files
   * @returns Promise<string[]> - Array of blob names
   */
  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobNames: string[] = [];
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        blobNames.push(blob.name);
      }
      return blobNames;
    } catch (error) {
      console.error('Error listing files from Azure Blob Storage:', error);
      throw new Error(`Error listing files from Azure Blob Storage: ${error}`);
    }
  }
  /**
   * Check if a file exists in Azure Blob Storage
   * @param blobName Name of the blob to check
   * @returns Promise<boolean> - True if exists
   */
  async fileExists(blobName: string): Promise<boolean> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const exists = await blockBlobClient.exists();
      return exists;
    } catch (error) {
      console.error('Error checking file existence in Azure Blob Storage:', error);
      return false;
    }
  }
}
/**
 * Convert base64 string to File object
 * @param base64String Base64 encoded string
 * @param fileName Name of the file
 * @param mimeType Optional MIME type
 * @returns File object
 */
export function base64ToFile(base64String: string, fileName: string, mimeType?: string): File {
  try {
    // Extract MIME type from data URL if it exists
    const mimeMatch = base64String.match(/^data:([^;]+);base64,/);
    const detectedMimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    // Use provided MIME type or detected one
    const finalMimeType = mimeType || detectedMimeType;
    // Remove data URL prefix if it exists
    const base64Data = base64String.replace(/^data:[^;]+;base64,/, '');
    // Convert base64 to bytes
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new File([byteArray], fileName, { type: finalMimeType });
  } catch (error) {
    console.error('Error converting base64 to file:', error);
    throw new Error(`Error converting base64 to file: ${error}`);
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
