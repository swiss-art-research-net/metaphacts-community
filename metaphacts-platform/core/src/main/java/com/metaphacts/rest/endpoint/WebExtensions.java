/*
 * "Commons Clause" License Condition v1.0
 *
 * The Software is provided to you by the Licensor under the
 * License, as defined below, subject to the following condition.
 *
 * Without limiting other conditions in the License, the grant
 * of rights under the License will not include, and the
 * License does not grant to you, the right to Sell the Software.
 *
 * For purposes of the foregoing, "Sell" means practicing any
 * or all of the rights granted to you under the License to
 * provide to third parties, for a fee or other consideration
 * (including without limitation fees for hosting or
 * consulting/ support services related to the Software), a
 * product or service whose value derives, entirely or substantially,
 * from the functionality of the Software. Any
 * license notice or attribution required by the License must
 * also include this Commons Clause License Condition notice.
 *
 * License: LGPL 2.1 or later
 * Licensor: metaphacts GmbH
 *
 * Copyright (C) 2015-2021, metaphacts GmbH
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
package com.metaphacts.rest.endpoint;

import javax.annotation.Nullable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Model of {@code web-extensions.json} file defining extensions for the
 * frontend.
 *
 * @author Stefan Schmitt <stefan.schmitt@metaphacts.com>
 */
public class WebExtensions {
    @Nullable
    private Map<String, WebComponentMetadata> components;
    @Nullable
    private List<String> extensions;

    public WebExtensions() {}

    public WebExtensions(
        Map<String, WebComponentMetadata> components,
        List<String> extensions
    ) {
        this.components = components;
        this.extensions = extensions;
    }

    public void setComponents(@Nullable Map<String, WebComponentMetadata> components) {
        this.components = components;
    }

    @Nullable
    public Map<String, WebComponentMetadata> getComponents() {
        return components;
    }

    public void setExtensions(@Nullable List<String> extensions) {
        this.extensions = extensions;
    }

    @Nullable
    public List<String> getExtensions() {
        return extensions;
    }

    public void normalize() {
        if (this.components == null) {
            this.components = new HashMap<>();
        }
        if (this.extensions == null) {
            this.extensions = new ArrayList<>();
        }
    }

    public void mergeFrom(WebExtensions other) {
        this.normalize();
        if (other.getComponents() != null) {
            for (var pair : other.getComponents().entrySet()) {
                this.components.put(pair.getKey(), pair.getValue());
            }
        }
        if (other.getExtensions() != null) {
            this.extensions.addAll(other.getExtensions());
        }
    }
}
