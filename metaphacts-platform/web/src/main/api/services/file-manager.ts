/*
 * Copyright (C) 2015-2019, metaphacts GmbH
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

import { post, del, Response } from 'superagent';
import * as Kefir from 'kefir';
import * as URI from 'urijs';

import { LdpService } from 'platform/api/services/ldp';
import { Rdf, vocabularies } from 'platform/api/rdf';
import { requestAsProperty } from 'platform/api/async';

export const FILE_UPLOAD_SERVICE_URL = '/file';
export const FILE_LDP_CONTAINER_ID = 'http://www.metaphacts.com/ontologies/platform#fileContainer';

export const FILE_URL = '';
export const ADMIN_URL = '/direct';
export const TEMPORARY_STORAGE_URL = '/temporary';
export const MOVE_URL = '/move';

const {VocabPlatform} = vocabularies;

export const RESOURCE_QUERY = `
  CONSTRUCT {
    ?__resourceIri__ a <${VocabPlatform.File.value}>.
    ?__resourceIri__ <${VocabPlatform.fileName.value}> ?__fileName__.
    ?__resourceIri__ <${VocabPlatform.mediaType.value}> ?__mediaType__.
    ?__resourceIri__ <${VocabPlatform.fileContext.value}> ?__contextUri__.
  } WHERE {}
`;

export type FileResource = {
  iri: string;
  fileName: string;
  mediaType: string;
}

class FileManager {
  public ldp = new LdpService(FILE_LDP_CONTAINER_ID);

  public uploadFileAsResource(options: {
    file: File;
    storage: string;
    contextUri?: string;
    generateIriQuery?: string;
    resourceQuery?: string;
    onProgress?: (percent: number) => void;
  }): Kefir.Property<FileResource> {
    if (!options.storage) {
      return Kefir.constantError<any>(new Error('Storage is undefined!'));
    }

    const request = post(FILE_UPLOAD_SERVICE_URL + FILE_URL)
      .attach('file', options.file as any)
      .field('storage', options.storage)
      .field('createResourceQuery', options.resourceQuery || RESOURCE_QUERY)
      .field('generateIriQuery', options.generateIriQuery || '')
      .field('contextUri', options.contextUri || '')
      .on('progress', e => {
        if (options.onProgress) {
          options.onProgress(<number>e.percent);
        }
      });

    return requestAsProperty(request).flatMap(response => {
      const fileIri = Rdf.iri(response.header.location);
      return this.getFileResourceByIri(fileIri.value);
    }).toProperty();
  }

  public uloadFileDirectly(options: {
    file: File;
    storage: string;
    folder: string;
    fileName?: string;
    onProgress?: (percent: number) => void;
  }): Kefir.Property<string> {
    if (!options.storage) {
      return Kefir.constantError<any>(new Error('Storage is undefined!'));
    }
    if (!options.folder) {
      return Kefir.constantError<any>(new Error('Path is undefined!'));
    }

    const request = post(FILE_UPLOAD_SERVICE_URL + ADMIN_URL)
      .attach('file', options.file as any)
      .field('storage', options.storage)
      .field('path', options.folder)
      .field('fileName', options.fileName || '')
      .on('progress', e => {
        if (options.onProgress) {
          options.onProgress(<number>e.percent);
        }
      });

    return requestAsProperty(request).map(response => {
      return response.ok ? response.text : null;
    });
  }

  // Returns temporary resource
  public uploadFileTemporary(options: {
    file: File;
    storage: string;
    onProgress?: (percent: number) => void;
  }): Kefir.Property<FileResource> {
    if (!options.storage) {
      return Kefir.constantError<any>(new Error('Storage is undefined!'));
    }

    const request = post(FILE_UPLOAD_SERVICE_URL + TEMPORARY_STORAGE_URL)
      .attach('file', options.file as any)
      .field('storage', options.storage)
      .on('progress', e => {
        if (options.onProgress) {
          options.onProgress(<number>e.percent);
        }
      });

    return requestAsProperty(request).map(response => {
      return createTemporaryResource(
        response.text,
        options.file.type
      );
    });
  }

  public createResourceFromTemporaryFile(options: {
    fileName: string;
    storage: string;
    temporaryStorage: string;
    contextUri?: string;
    mediaType: string;
    generateIriQuery?: string;
    resourceQuery?: string;
    onProgress?: (percent: number) => void;
  }): Kefir.Property<FileResource> {
    const request = post(FILE_UPLOAD_SERVICE_URL + MOVE_URL)
      .field('fileName', options.fileName)
      .field('storage', options.storage)
      .field('temporaryStorage', options.temporaryStorage)
      .field('createResourceQuery',  options.resourceQuery || RESOURCE_QUERY)
      .field('mediaType', options.mediaType)
      .field('generateIriQuery', options.generateIriQuery || '')
      .field('contextUri', options.contextUri || '')
      .on('progress', e => {
        if (options.onProgress) {
          options.onProgress(<number>e.percent);
        }
      });

    return requestAsProperty(request).flatMap(response => {
      return this.getFileResourceByIri(response.header.location);
    }).toProperty();
  }

  public deleteFileResource(resourceIri: string, fileStorage: string): Kefir.Property<Response> {
    return this.getFileResourceByIri(resourceIri).flatMap(resource => {
      const request = del(FILE_UPLOAD_SERVICE_URL + FILE_URL)
        .field('fileName', resource.fileName)
        .field('storage', fileStorage)
        .field('resourceIri', resource.iri);

      return requestAsProperty(request);
    }).toProperty();
  }

  public removeTemporaryFile(fileName: string, fileStorage: string): Kefir.Property<Response> {
    const request = del(FILE_UPLOAD_SERVICE_URL + TEMPORARY_STORAGE_URL)
      .field('fileName', fileName)
      .field('storage', fileStorage);

    return requestAsProperty(request);
  }

  public getFileResourceGraphByIri(resourceIri: string): Kefir.Property<Rdf.Graph> {
    const fileIri = Rdf.iri(resourceIri);
    return this.ldp.get(fileIri);
  }

  public getFileResourceByIri(fileResourceIri: string, options?: {
    namePredicateIri?: string,
    mediaTypePredicateIri?: string,
  }): Kefir.Property<FileResource> {
    if (this.isTemporaryResourceIri(fileResourceIri)) {
      return Kefir.constant({
        ...decodeTemporaryResourceIri(fileResourceIri),
        iri: fileResourceIri
      });
    } else {
      options = options || {};
      const namePredicateIri = options.namePredicateIri || VocabPlatform.fileName.value;
      const mediaTypePredicateIri = options.mediaTypePredicateIri || VocabPlatform.mediaType.value;

      return this.getFileResourceGraphByIri(fileResourceIri).flatMap(graph => {
        const triples = graph.triples;
        const resource: FileResource = {
          iri: fileResourceIri,
          fileName:  triples.find(tripple => { return tripple.p.value === namePredicateIri; }).o.value,
          mediaType:  triples.find(tripple => { return tripple.p.value === mediaTypePredicateIri; }).o.value,
        };

        if (resource.fileName && resource.mediaType) {
          return Kefir.constant<FileResource>(resource);
        } else {
          return Kefir.constantError<any>(new Error(`
One or both of resource properties was missed!
Probably it happened because you defined new resource query,
but didn't provide custom values to this function.
          `));
        }
      }).toProperty();
    }
  }

  public getFileUrl(fileName: string, fileStorage: string): string {
    return new URI(FILE_UPLOAD_SERVICE_URL).addQuery({
      'fileName': fileName,
      'storage': fileStorage,
    }).toString();
  }

  // FileInput component encode its state into iri, and FileVizualizer support visualization of temporary IRIs
  // so this function is here - don't store this-kind of IRIs because they are in-memory entities.
  public isTemporaryResourceIri(resourceIri: string): boolean {
    return resourceIri.startsWith(VocabPlatform.temporaryFilePrefix);
  }
}

export const FileManagerService = new FileManager();

// These functions are used by FileInput and FileVisualizer component
// to store and visualize temporary state of FileInput component
function createTemporaryResource(fileName: string, mediaType: string): FileResource {
  return {
    iri: encodeTemporaryResourceIri(fileName, mediaType),
    fileName,
    mediaType,
  };
}

function encodeTemporaryResourceIri(fileName: string, mediaType: string): string {
  const encodedMediaType = encodeURIComponent(mediaType);
  const encodedName = encodeURIComponent(fileName);
  return `${VocabPlatform.temporaryFilePrefix}${encodedMediaType}/${encodedName}`;
}

function decodeTemporaryResourceIri(iri: string): { mediaType: string; fileName: string } {
  const bufferString = iri.substring(VocabPlatform.temporaryFilePrefix.length, iri.length);
  if (!bufferString) {
    throw new Error(`Unable to decode IRI ${iri}!`);
  }
  const [encodedMediaType, encodedName] = bufferString.split('/');
  if (!(encodedMediaType && encodedName)) {
    throw new Error(`Unable to decode IRI ${iri}! One of provided parameters is missing!`);
  }
  const _fileName = decodeURIComponent(encodedName);
  return {
    mediaType: decodeURIComponent(encodedMediaType),
    fileName: _fileName,
  };
}
