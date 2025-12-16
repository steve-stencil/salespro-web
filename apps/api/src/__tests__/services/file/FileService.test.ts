/**
 * Tests for FileService.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { File, FileStatus, FileVisibility } from '../../../entities';
import {
  FileService,
  FileServiceError,
  FileErrorCode,
} from '../../../services/file';

import type { Company, User } from '../../../entities';
import type { EntityManager } from '@mikro-orm/core';

// Mock storage
vi.mock('../../../lib/storage', () => ({
  getStorageAdapter: vi.fn(() => mockStorageAdapter),
  isS3Configured: vi.fn(() => false),
  generateStorageKey: vi.fn(
    (companyId, fileId, ext) => `${companyId}/files/${fileId}.${ext}`,
  ),
  getFileExtension: vi.fn(filename => filename.split('.').pop() ?? 'bin'),
  isImageMimeType: vi.fn(mimeType => mimeType.startsWith('image/')),
  sanitizeFilename: vi.fn(filename => filename),
  isFileTypeAllowed: vi.fn(() => true),
}));

// Mock env
vi.mock('../../../config/env', () => ({
  env: {
    MAX_FILE_SIZE_MB: 10,
    ALLOWED_FILE_TYPES: 'image/*,application/pdf',
  },
}));

// Mock thumbnail
vi.mock('../../../services/file/thumbnail', () => ({
  generateAndUploadThumbnail: vi.fn(() =>
    Promise.resolve('company-123/thumbnails/file-id_thumb.jpg'),
  ),
  generateThumbnailAsync: vi.fn(() => Promise.resolve()),
}));

const mockStorageAdapter = {
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  generatePresignedUpload: vi.fn(),
};

// Create mock functions that we can reference
const mockFindOne = vi.fn();
const mockFindAndCount = vi.fn();
const mockPersistAndFlush = vi.fn();
const mockFlush = vi.fn();

describe('FileService', () => {
  let service: FileService;
  let mockEm: EntityManager;
  let mockUser: User;
  let mockCompany: Company;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    mockCompany = {
      id: 'company-123',
      name: 'Test Company',
    } as Company;

    mockUser = {
      id: 'user-456',
      email: 'test@example.com',
      company: mockCompany,
    } as User;

    mockEm = {
      findOne: mockFindOne,
      findAndCount: mockFindAndCount,
      persistAndFlush: mockPersistAndFlush,
      flush: mockFlush,
      fork: vi.fn(() => mockEm),
    } as unknown as EntityManager;

    service = new FileService(mockEm);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      mockStorageAdapter.upload.mockResolvedValue({
        key: 'company-123/files/new-file-id.pdf',
        size: 1000,
      });

      const result = await service.uploadFile({
        buffer: Buffer.from('test content'),
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        user: mockUser,
        company: mockCompany,
      });

      expect(result).toBeInstanceOf(File);
      expect(result.filename).toBe('test.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.company).toBe(mockCompany);
      expect(result.uploadedBy).toBe(mockUser);
      expect(mockPersistAndFlush).toHaveBeenCalled();
    });

    it('should set default visibility to COMPANY', async () => {
      mockStorageAdapter.upload.mockResolvedValue({
        key: 'company-123/files/file.pdf',
        size: 1000,
      });

      const result = await service.uploadFile({
        buffer: Buffer.from('test'),
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        user: mockUser,
        company: mockCompany,
      });

      expect(result.visibility).toBe(FileVisibility.COMPANY);
    });

    it('should respect provided visibility', async () => {
      mockStorageAdapter.upload.mockResolvedValue({
        key: 'company-123/files/file.pdf',
        size: 1000,
      });

      const result = await service.uploadFile({
        buffer: Buffer.from('test'),
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        user: mockUser,
        company: mockCompany,
        visibility: FileVisibility.PUBLIC,
      });

      expect(result.visibility).toBe(FileVisibility.PUBLIC);
    });

    it('should throw error on storage failure', async () => {
      mockStorageAdapter.upload.mockRejectedValue(new Error('Upload failed'));

      await expect(
        service.uploadFile({
          buffer: Buffer.from('test'),
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          user: mockUser,
          company: mockCompany,
        }),
      ).rejects.toThrow(FileServiceError);
    });

    it('should throw error for disallowed file type', async () => {
      const { isFileTypeAllowed } = await import('../../../lib/storage');
      vi.mocked(isFileTypeAllowed).mockReturnValue(false);

      await expect(
        service.uploadFile({
          buffer: Buffer.from('test'),
          filename: 'test.exe',
          mimeType: 'application/x-msdownload',
          user: mockUser,
          company: mockCompany,
        }),
      ).rejects.toThrow(FileServiceError);
    });

    it('should throw error for file too large', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      await expect(
        service.uploadFile({
          buffer: largeBuffer,
          filename: 'large.pdf',
          mimeType: 'application/pdf',
          user: mockUser,
          company: mockCompany,
        }),
      ).rejects.toThrow(FileServiceError);
    });
  });

  describe('getFile', () => {
    it('should return a file when found', async () => {
      const mockFile = new File();
      mockFile.id = 'file-123';
      mockFile.visibility = FileVisibility.COMPANY;
      mockFile.uploadedBy = mockUser;

      mockFindOne.mockResolvedValue(mockFile);

      const result = await service.getFile('file-123', 'company-123');

      expect(result).toBe(mockFile);
    });

    it('should return null when file not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await service.getFile('nonexistent', 'company-123');

      expect(result).toBeNull();
    });

    it('should return null for private files from other users', async () => {
      const mockFile = new File();
      mockFile.id = 'file-123';
      mockFile.visibility = FileVisibility.PRIVATE;
      mockFile.uploadedBy = { id: 'other-user' } as User;

      mockFindOne.mockResolvedValue(mockFile);

      const result = await service.getFile(
        'file-123',
        'company-123',
        'user-456',
      );

      expect(result).toBeNull();
    });
  });

  describe('getDownloadUrl', () => {
    it('should return a download URL', async () => {
      const mockFile = new File();
      mockFile.id = 'file-123';
      mockFile.storageKey = 'company-123/files/file-123.pdf';
      mockFile.filename = 'document.pdf';
      mockFile.visibility = FileVisibility.COMPANY;
      mockFile.uploadedBy = mockUser;

      mockFindOne.mockResolvedValue(mockFile);
      mockStorageAdapter.getSignedDownloadUrl.mockResolvedValue(
        'https://signed-url.com/file',
      );

      const url = await service.getDownloadUrl('file-123', 'company-123');

      expect(url).toBe('https://signed-url.com/file');
    });

    it('should throw error when file not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        service.getDownloadUrl('nonexistent', 'company-123'),
      ).rejects.toThrow(FileServiceError);
    });
  });

  describe('listFiles', () => {
    it('should return paginated files', async () => {
      const mockFiles = [new File(), new File()];
      mockFindAndCount.mockResolvedValue([mockFiles, 2]);

      const result = await service.listFiles('company-123');

      expect(result.files).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should apply pagination options', async () => {
      mockFindAndCount.mockResolvedValue([[], 50]);

      const result = await service.listFiles('company-123', {
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(5);
    });

    it('should filter by visibility', async () => {
      mockFindAndCount.mockResolvedValue([[], 0]);

      await service.listFiles('company-123', {
        visibility: FileVisibility.PUBLIC,
      });

      expect(mockFindAndCount).toHaveBeenCalledWith(
        File,
        expect.objectContaining({
          visibility: FileVisibility.PUBLIC,
        }),
        expect.any(Object),
      );
    });
  });

  describe('updateFile', () => {
    it('should update file metadata', async () => {
      const mockFile = new File();
      mockFile.id = 'file-123';
      mockFile.filename = 'old-name.pdf';

      mockFindOne.mockResolvedValue(mockFile);

      const result = await service.updateFile('file-123', 'company-123', {
        filename: 'new-name.pdf',
        visibility: FileVisibility.PUBLIC,
      });

      expect(result.filename).toBe('new-name.pdf');
      expect(result.visibility).toBe(FileVisibility.PUBLIC);
      expect(mockFlush).toHaveBeenCalled();
    });

    it('should throw error when file not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        service.updateFile('nonexistent', 'company-123', {}),
      ).rejects.toThrow(FileServiceError);
    });
  });

  describe('deleteFile', () => {
    it('should soft delete a file', async () => {
      const mockFile = new File();
      mockFile.id = 'file-123';
      mockFile.status = FileStatus.ACTIVE;

      mockFindOne.mockResolvedValue(mockFile);

      await service.deleteFile('file-123', 'company-123');

      expect(mockFile.status).toBe(FileStatus.DELETED);
      expect(mockFile.deletedAt).toBeInstanceOf(Date);
      expect(mockFlush).toHaveBeenCalled();
    });

    it('should throw error when file not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(
        service.deleteFile('nonexistent', 'company-123'),
      ).rejects.toThrow(FileServiceError);
    });
  });

  describe('FileServiceError', () => {
    it('should have correct error code', () => {
      const error = new FileServiceError(
        'File not found',
        FileErrorCode.FILE_NOT_FOUND,
      );

      expect(error.message).toBe('File not found');
      expect(error.code).toBe(FileErrorCode.FILE_NOT_FOUND);
      expect(error.name).toBe('FileServiceError');
    });
  });
});
