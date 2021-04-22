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
package com.metaphacts.lookup.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import javax.annotation.Nullable;
import java.util.List;
import java.util.Objects;

public class LookupServiceManifest {
    private String name;
    private String identifierSpace;
    private String schemaSpace;
    private List<LookupEntityType> defaultTypes;

    @JsonProperty("view")
    private BasicService viewService;
    @JsonProperty("preview")
    private PreviewService previewService;
    private BasicService labelService;
    private BasicService descriptionService;
    private BasicService typeService;

    public LookupServiceManifest() {
    }

    public LookupServiceManifest(
        String name,
        String identifierSpace,
        String schemaSpace,
        List<LookupEntityType> defaultTypes,
        @Nullable BasicService viewService,
        @Nullable PreviewService previewService,
        @Nullable BasicService labelService,
        @Nullable BasicService descriptionService,
        @Nullable BasicService typeService
    ) {
        this.name = name;
        this.identifierSpace = identifierSpace;
        this.schemaSpace = schemaSpace;
        this.defaultTypes = defaultTypes;
        this.viewService = viewService;
        this.previewService = previewService;
        this.labelService = labelService;
        this.descriptionService = descriptionService;
        this.typeService = typeService;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getIdentifierSpace() {
        return identifierSpace;
    }

    public void setIdentifierSpace(String identifierSpace) {
        this.identifierSpace = identifierSpace;
    }

    public String getSchemaSpace() {
        return schemaSpace;
    }

    public void setSchemaSpace(String schemaSpace) {
        this.schemaSpace = schemaSpace;
    }

    public List<LookupEntityType> getDefaultTypes() {
        return defaultTypes;
    }

    public void setDefaultTypes(List<LookupEntityType> defaultTypes) {
        this.defaultTypes = defaultTypes;
    }

    public BasicService getViewService() {
        return viewService;
    }

    public void setViewService(BasicService viewService) {
        this.viewService = viewService;
    }

    public PreviewService getPreviewService() {
        return previewService;
    }

    public void setPreviewService(PreviewService previewService) {
        this.previewService = previewService;
    }

    public BasicService getLabelService() {
        return labelService;
    }

    public void setLabelService(BasicService labelService) {
        this.labelService = labelService;
    }

    public BasicService getDescriptionService() {
        return descriptionService;
    }

    public void setDescriptionService(BasicService descriptionService) {
        this.descriptionService = descriptionService;
    }

    public BasicService getTypeService() {
        return typeService;
    }

    public void setTypeService(BasicService typeService) {
        this.typeService = typeService;
    }

    public static class BasicService {
        protected String url;

        public BasicService() {
        }

        public BasicService(String url) {
            this.url = url;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }

        @Override public boolean equals(Object o) {
            if (this == o)
                return true;
            if (o == null || getClass() != o.getClass())
                return false;
            BasicService that = (BasicService) o;
            return Objects.equals(url, that.url);
        }

        @Override public int hashCode() {
            return Objects.hash(url);
        }
    }

    public static class PreviewService extends BasicService {
        private int width;
        private int height;

        public PreviewService() {
            super(null);
        }

        public PreviewService(String url, int width, int height) {
            super(url);
            this.width = width;
            this.height = height;
        }

        public int getWidth() {
            return width;
        }

        public int getHeight() {
            return height;
        }

        public void setWidth(int width) {
            this.width = width;
        }

        public void setHeight(int height) {
            this.height = height;
        }
    }
}
