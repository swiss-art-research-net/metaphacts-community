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

package com.metaphacts.services.storage.api;

import org.apache.commons.io.IOUtils;
import org.apache.commons.io.output.ByteArrayOutputStream;

import java.io.IOException;
import java.io.InputStream;

/**
 * Represents an {@link InputStream} with known byte size.
 */
public class SizedStream implements AutoCloseable {
    private final InputStream stream;
    private final long length;

    public SizedStream(InputStream stream, long length) {
        this.stream = stream;
        this.length = length;
    }

    public InputStream getStream() {
        return stream;
    }

    public long getLength() {
        return length;
    }

    @Override
    public void close() throws IOException {
        stream.close();
    }

    /**
     * Buffers the whole stream in memory to compute its byte length.
     *
     * Warning: try avoid using this method if possible, otherwise it may lead to out of memory
     * issues if the stream content is too large.
     */
    public static SizedStream bufferAndMeasure(InputStream stream) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        IOUtils.copy(stream, buffer);
        return new SizedStream(buffer.toInputStream(), buffer.size());
    }
}
