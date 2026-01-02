/**
 * File upload API service.
 * Provides methods for uploading files to the server.
 */
import { axiosInstance } from '../lib/api-client';

/** File visibility options */
export type FileVisibility = 'private' | 'company' | 'public';

/** Response from file upload */
export type FileUploadResponse = {
  message: string;
  file: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url: string;
    thumbnailUrl: string | null;
    isImage: boolean;
    createdAt: string;
  };
};

/** Options for file upload */
export type UploadFileOptions = {
  visibility?: FileVisibility;
  description?: string;
};

/**
 * File upload API methods.
 */
export const filesApi = {
  /**
   * Upload a file to the server.
   * Files are automatically company-scoped and stored in S3.
   *
   * @param file - File to upload
   * @param options - Optional visibility and description
   * @returns Uploaded file details including presigned URLs
   */
  upload: async (
    file: File,
    options?: UploadFileOptions,
  ): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    if (options?.visibility) {
      formData.append('visibility', options.visibility);
    }
    if (options?.description) {
      formData.append('description', options.description);
    }

    const response = await axiosInstance.post<FileUploadResponse>(
      '/files/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  /**
   * Upload an image file specifically.
   * Validates that the file is an image type before uploading.
   *
   * @param file - Image file to upload
   * @param options - Optional visibility and description
   * @returns Uploaded file details
   * @throws Error if file is not an image
   */
  uploadImage: async (
    file: File,
    options?: UploadFileOptions,
  ): Promise<FileUploadResponse> => {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }
    return filesApi.upload(file, options);
  },

  /**
   * Delete a file from the server.
   * This performs a soft delete - the file is marked as deleted but may be retained.
   *
   * @param fileId - ID of the file to delete
   */
  deleteFile: async (fileId: string): Promise<void> => {
    await axiosInstance.delete(`/files/${fileId}`);
  },
};
