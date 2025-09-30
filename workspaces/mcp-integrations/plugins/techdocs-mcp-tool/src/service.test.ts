/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ConfigReader } from '@backstage/config';
import { TechDocsService } from './service';
import { Entity } from '@backstage/catalog-model';
import { LoggerService, DiscoveryService } from '@backstage/backend-plugin-api';

describe('TechDocsService', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as LoggerService;

  const mockDiscovery = {
    getBaseUrl: jest.fn(),
  } as unknown as DiscoveryService;

  const mockConfig = new ConfigReader({
    app: {
      baseUrl: 'http://localhost:3000',
    },
  });

  let service: TechDocsService;

  const entity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'test-component',
      namespace: 'default',
      annotations: {
        'backstage.io/techdocs-ref': 'dir:.',
      },
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'team-a',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TechDocsService(mockConfig, mockLogger, mockDiscovery);

    // Mock discovery service
    (mockDiscovery.getBaseUrl as jest.Mock).mockImplementation(
      (pluginId: string) => {
        if (pluginId === 'catalog') {
          return Promise.resolve('http://localhost:7007/api/catalog');
        }
        if (pluginId === 'techdocs') {
          return Promise.resolve('http://localhost:7007/api/techdocs');
        }
        return Promise.resolve(`http://localhost:7007/api/${pluginId}`);
      },
    );
  });

  describe('generateTechDocsUrls', () => {
    it('should generate correct URLs for an entity', async () => {
      const urls = await service.generateTechDocsUrls(entity);

      expect(urls).toEqual({
        techDocsUrl:
          'http://localhost:3000/docs/default/component/test-component',
        metadataUrl:
          'http://localhost:7007/api/catalog/entities/by-name/component/default/test-component',
      });
    });
  });

  describe('fetchTechDocsMetadata', () => {
    it('should fetch metadata via HTTP API', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          site_name: 'Test Docs',
          build_timestamp: 1640995200,
        }),
      });

      const serviceWithMockFetch = new TechDocsService(
        mockConfig,
        mockLogger,
        mockDiscovery,
        mockFetch,
      );

      const result = await serviceWithMockFetch.fetchTechDocsMetadata(entity);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:7007/api/techdocs/metadata/default/component/test-component',
        { headers: {} },
      );
      expect(result).toEqual({
        site_name: 'Test Docs',
        build_timestamp: 1640995200,
      });
    });

    it('should return null when metadata not found', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const serviceWithMockFetch = new TechDocsService(
        mockConfig,
        mockLogger,
        mockDiscovery,
        mockFetch,
      );

      const result = await serviceWithMockFetch.fetchTechDocsMetadata(entity);

      expect(result).toBeNull();
    });
  });

  describe('service instantiation', () => {
    it('should create service without publisher dependencies', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(TechDocsService);
    });
  });
});
