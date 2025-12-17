/**
 * Integration tests for file routes.
 */

import { v4 as uuid } from 'uuid';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  beforeEach,
  vi,
} from 'vitest';

import {
  RoleType,
  Company,
  User,
  Role,
  UserRole,
  Session,
  File,
  FileStatus,
  FileVisibility,
  SessionSource,
} from '../../entities';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import { makeRequest, waitForDatabase } from './helpers';

// Mock storage adapter for tests
vi.mock('../../lib/storage', () => ({
  getStorageAdapter: vi.fn(() => ({
    upload: vi.fn().mockResolvedValue({
      key: 'test-key',
      size: 1000,
      etag: '"abc123"',
    }),
    download: vi.fn().mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/require-await
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from('test content');
      },
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    getSignedDownloadUrl: vi
      .fn()
      .mockResolvedValue('https://example.com/signed-url'),
    generatePresignedUpload: vi.fn().mockResolvedValue({
      url: 'https://example.com/upload-url',
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      expiresAt: new Date(Date.now() + 900000),
    }),
  })),
  isS3Configured: vi.fn().mockReturnValue(true),
  generateStorageKey: vi.fn(
    (companyId: string, fileId: string, ext: string) =>
      `${companyId}/files/${fileId}.${ext}`,
  ),
  getFileExtension: vi.fn((filename: string) => filename.split('.').pop()),
  isImageMimeType: vi.fn((mimeType: string) => mimeType.startsWith('image/')),
  sanitizeFilename: vi.fn((filename: string) => filename),
  isFileTypeAllowed: vi.fn(() => true),
}));

// Mock thumbnail generation
vi.mock('../../services/file/thumbnail', () => ({
  generateAndUploadThumbnail: vi.fn().mockResolvedValue('test-thumbnail-key'),
  generateThumbnailAsync: vi.fn().mockResolvedValue(undefined),
}));

describe('File Routes Integration Tests', () => {
  let testCompany: Company;
  let testUser: User;
  let adminRole: Role;
  let sessionId: string;
  let cookie: string;

  beforeAll(async () => {
    await waitForDatabase();
  });

  beforeEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Create test company
    testCompany = em.create(Company, {
      id: uuid(),
      name: 'Test Company',
      maxSessionsPerUser: 5,
      mfaRequired: false,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        historyCount: 3,
        maxAgeDays: 90,
      },
    });
    em.persist(testCompany);

    // Create admin role with file permissions
    adminRole = em.create(Role, {
      id: uuid(),
      name: 'fileAdmin',
      displayName: 'File Admin',
      permissions: [
        PERMISSIONS.FILE_READ,
        PERMISSIONS.FILE_CREATE,
        PERMISSIONS.FILE_UPDATE,
        PERMISSIONS.FILE_DELETE,
      ],
      type: RoleType.SYSTEM,
      isDefault: false,
    });
    em.persist(adminRole);

    // Create test user
    testUser = em.create(User, {
      id: uuid(),
      email: `test-file-${Date.now()}@example.com`,
      passwordHash: await hashPassword('TestPassword123!'),
      nameFirst: 'Test',
      nameLast: 'User',
      isActive: true,
      emailVerified: true,
      mfaEnabled: false,
      company: testCompany,
    });
    em.persist(testUser);

    // Assign admin role to user
    const userRole = em.create(UserRole, {
      id: uuid(),
      user: testUser,
      role: adminRole,
      company: testCompany,
    });
    em.persist(userRole);

    // Create session
    sessionId = uuid();
    const session = em.create(Session, {
      sid: sessionId,
      user: testUser,
      company: testCompany,
      data: { userId: testUser.id },
      source: SessionSource.WEB,
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      mfaVerified: false,
    });
    em.persist(session);

    await em.flush();

    // Set cookie for authenticated requests
    cookie = `sid=${sessionId}`;
  });

  afterEach(async () => {
    const orm = getORM();
    const em = orm.em.fork();

    // Clean up test data
    await em.nativeDelete(File, { company: testCompany.id });
    await em.nativeDelete(Session, { company: testCompany.id });
    await em.nativeDelete(UserRole, { company: testCompany.id });
    await em.nativeDelete(User, { company: testCompany.id });
    await em.nativeDelete(Role, { id: adminRole.id });
    await em.nativeDelete(Company, { id: testCompany.id });

    vi.clearAllMocks();
  });

  describe('POST /api/files/upload', () => {
    it('should upload a file successfully', async () => {
      const response = await makeRequest()
        .post('/api/files/upload')
        .set('Cookie', cookie)
        .attach('file', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('File uploaded successfully');
      expect(response.body.file).toHaveProperty('id');
      expect(response.body.file.filename).toBe('test.pdf');
    });

    it('should return 401 without authentication', async () => {
      const response = await makeRequest()
        .post('/api/files/upload')
        .attach('file', Buffer.from('test'), 'test.pdf');

      expect(response.status).toBe(401);
    });

    it('should return 400 without file', async () => {
      const response = await makeRequest()
        .post('/api/files/upload')
        .set('Cookie', cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file provided');
    });

    it('should accept visibility option', async () => {
      const response = await makeRequest()
        .post('/api/files/upload')
        .set('Cookie', cookie)
        .field('visibility', FileVisibility.PUBLIC)
        .attach('file', Buffer.from('test'), 'test.pdf');

      expect(response.status).toBe(201);
      expect(response.body.file.visibility).toBe(FileVisibility.PUBLIC);
    });
  });

  // TODO: Implement presigned URL upload feature
  describe.skip('POST /api/files/presign', () => {
    it('should generate a presigned upload URL', async () => {
      const response = await makeRequest()
        .post('/api/files/presign')
        .set('Cookie', cookie)
        .send({
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fileId');
      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body).toHaveProperty('method');
      expect(response.body).toHaveProperty('headers');
    });

    it('should return 400 for invalid request', async () => {
      const response = await makeRequest()
        .post('/api/files/presign')
        .set('Cookie', cookie)
        .send({
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  // TODO: Implement presigned URL upload confirmation
  describe.skip('POST /api/files/confirm', () => {
    it('should confirm a presigned upload', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a pending file
      const pendingFile = em.create(File, {
        id: uuid(),
        filename: 'pending.pdf',
        storageKey: `${testCompany.id}/files/pending.pdf`,
        mimeType: 'application/pdf',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.PENDING,
        company: testCompany,
        uploadedBy: testUser,
      });
      await em.persistAndFlush(pendingFile);

      const response = await makeRequest()
        .post('/api/files/confirm')
        .set('Cookie', cookie)
        .send({ fileId: pendingFile.id });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Upload confirmed');
      expect(response.body.file.id).toBe(pendingFile.id);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await makeRequest()
        .post('/api/files/confirm')
        .set('Cookie', cookie)
        .send({ fileId: uuid() });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/files', () => {
    it('should list files for the company', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create test files
      for (let i = 0; i < 3; i++) {
        const file = em.create(File, {
          id: uuid(),
          filename: `test-${i}.pdf`,
          storageKey: `${testCompany.id}/files/test-${i}.pdf`,
          mimeType: 'application/pdf',
          size: 1024,
          visibility: FileVisibility.COMPANY,
          status: FileStatus.ACTIVE,
          company: testCompany,
          uploadedBy: testUser,
        });
        em.persist(file);
      }
      await em.flush();

      const response = await makeRequest()
        .get('/api/files')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(3);
      expect(response.body.pagination).toHaveProperty('total', 3);
    });

    it('should support pagination', async () => {
      const response = await makeRequest()
        .get('/api/files')
        .query({ page: 1, limit: 10 })
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
    });

    it('should filter by visibility', async () => {
      const response = await makeRequest()
        .get('/api/files')
        .query({ visibility: FileVisibility.PUBLIC })
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/files/:id', () => {
    it('should get file metadata', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const file = em.create(File, {
        id: uuid(),
        filename: 'test.pdf',
        storageKey: `${testCompany.id}/files/test.pdf`,
        mimeType: 'application/pdf',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        company: testCompany,
        uploadedBy: testUser,
      });
      await em.persistAndFlush(file);

      const response = await makeRequest()
        .get(`/api/files/${file.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.file.id).toBe(file.id);
      expect(response.body.file.filename).toBe('test.pdf');
    });

    it('should return 404 for non-existent file', async () => {
      const response = await makeRequest()
        .get(`/api/files/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/files/:id/download', () => {
    it('should return a download URL', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const file = em.create(File, {
        id: uuid(),
        filename: 'download.pdf',
        storageKey: `${testCompany.id}/files/download.pdf`,
        mimeType: 'application/pdf',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        company: testCompany,
        uploadedBy: testUser,
      });
      await em.persistAndFlush(file);

      const response = await makeRequest()
        .get(`/api/files/${file.id}/download`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('downloadUrl');
    });
  });

  describe('GET /api/files/:id/thumbnail', () => {
    it('should return thumbnail URL when available', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const file = em.create(File, {
        id: uuid(),
        filename: 'image.jpg',
        storageKey: `${testCompany.id}/files/image.jpg`,
        mimeType: 'image/jpeg',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        thumbnailKey: `${testCompany.id}/thumbnails/image_thumb.jpg`,
        company: testCompany,
        uploadedBy: testUser,
      });
      await em.persistAndFlush(file);

      const response = await makeRequest()
        .get(`/api/files/${file.id}/thumbnail`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('thumbnailUrl');
    });

    it('should return 404 when no thumbnail', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const file = em.create(File, {
        id: uuid(),
        filename: 'document.pdf',
        storageKey: `${testCompany.id}/files/document.pdf`,
        mimeType: 'application/pdf',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        company: testCompany,
        uploadedBy: testUser,
      });
      await em.persistAndFlush(file);

      const response = await makeRequest()
        .get(`/api/files/${file.id}/thumbnail`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Thumbnail not available');
    });
  });

  describe('PATCH /api/files/:id', () => {
    it('should update file metadata', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const file = em.create(File, {
        id: uuid(),
        filename: 'original.pdf',
        storageKey: `${testCompany.id}/files/original.pdf`,
        mimeType: 'application/pdf',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        company: testCompany,
        uploadedBy: testUser,
      });
      await em.persistAndFlush(file);

      const response = await makeRequest()
        .patch(`/api/files/${file.id}`)
        .set('Cookie', cookie)
        .send({
          filename: 'updated.pdf',
          visibility: FileVisibility.PUBLIC,
        });

      expect(response.status).toBe(200);
      expect(response.body.file.filename).toBe('updated.pdf');
      expect(response.body.file.visibility).toBe(FileVisibility.PUBLIC);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await makeRequest()
        .patch(`/api/files/${uuid()}`)
        .set('Cookie', cookie)
        .send({ filename: 'test.pdf' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/files/:id', () => {
    it('should soft delete a file', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      const file = em.create(File, {
        id: uuid(),
        filename: 'delete-me.pdf',
        storageKey: `${testCompany.id}/files/delete-me.pdf`,
        mimeType: 'application/pdf',
        size: 1024,
        visibility: FileVisibility.COMPANY,
        status: FileStatus.ACTIVE,
        company: testCompany,
        uploadedBy: testUser,
      });
      await em.persistAndFlush(file);

      const response = await makeRequest()
        .delete(`/api/files/${file.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('File deleted');

      // Verify file is soft deleted
      const deletedFile = await em.findOne(File, { id: file.id });
      expect(deletedFile?.status).toBe(FileStatus.DELETED);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await makeRequest()
        .delete(`/api/files/${uuid()}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
    });
  });

  describe('Permission checks', () => {
    it('should deny access without FILE_READ permission', async () => {
      const orm = getORM();
      const em = orm.em.fork();

      // Create a role without file permissions
      const limitedRole = em.create(Role, {
        id: uuid(),
        name: 'limitedRole',
        displayName: 'Limited Role',
        permissions: [], // No permissions
        type: RoleType.COMPANY,
        isDefault: false,
        company: testCompany,
      });
      em.persist(limitedRole);

      // Create new user with limited role
      const limitedUser = em.create(User, {
        id: uuid(),
        email: `limited-${Date.now()}@example.com`,
        passwordHash: await hashPassword('TestPassword123!'),
        nameFirst: 'Limited',
        nameLast: 'User',
        isActive: true,
        emailVerified: true,
        mfaEnabled: false,
        company: testCompany,
      });
      em.persist(limitedUser);

      const limitedUserRole = em.create(UserRole, {
        id: uuid(),
        user: limitedUser,
        role: limitedRole,
        company: testCompany,
      });
      em.persist(limitedUserRole);

      // Create session for limited user
      const limitedSessionId = uuid();
      const limitedSession = em.create(Session, {
        sid: limitedSessionId,
        user: limitedUser,
        company: testCompany,
        data: { userId: limitedUser.id },
        source: SessionSource.WEB,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        mfaVerified: false,
      });
      em.persist(limitedSession);

      await em.flush();

      const limitedCookie = `sid=${limitedSessionId}`;

      const response = await makeRequest()
        .get('/api/files')
        .set('Cookie', limitedCookie);

      expect(response.status).toBe(403);
    });
  });
});
