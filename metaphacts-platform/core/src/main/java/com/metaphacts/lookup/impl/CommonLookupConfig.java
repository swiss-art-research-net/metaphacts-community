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
package com.metaphacts.lookup.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import javax.annotation.Nullable;
import javax.validation.constraints.NotNull;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.util.Models;

import com.google.common.cache.CacheBuilderSpec;
import com.metaphacts.lookup.spi.AbstractLookupServiceConfig;
import com.metaphacts.lookup.spi.LookupServiceConfigException;
import com.metaphacts.util.LanguageHelper;

/**
 * Common configuration options for a LookupService.
 *
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class CommonLookupConfig extends AbstractLookupServiceConfig {
    public static final LookupScoreOptions DEFAULT_SCORE_OPTIONS = new LookupScoreOptions(1, 0);
    protected IRI datasetId;
    protected String datasetLabel;
    protected String lookupCacheConfig;
    protected LookupScoreOptions lookupScoreOptions;
    protected String preferredLanguage;

    public CommonLookupConfig() {
    }

    public CommonLookupConfig(String type) {
        super(type);
    }

    /**
     * Defines constant dataset id for all candidates in lookup response.
     * @return dataset id or <code>null</code> if not defined.
     */
    public IRI getDatasetId() {
        return datasetId;
    }

    public void setDatasetId(IRI datasetId) {
        this.datasetId = datasetId;
    }

    /**
     * Defines constant dataset label for all candidates in lookup response.
     * @return dataset label or <code>null</code> if not defined.
     */
    public String getDatasetLabel() {
        return datasetLabel;
    }

    public void setDatasetLabel(String datasetLabel) {
        this.datasetLabel = datasetLabel;
    }

    /**
     * Defines the <a href="https://guava.dev/releases/snapshot-jre/api/docs/com/google/common/cache/CacheBuilderSpec.html">cache configuration</a> for this lookup service.
     * @return cache configuration or <code>null</code> if not defined.
     *
     * @see CacheBuilderSpec
     */
    public String getLookupCacheConfig() {
        return lookupCacheConfig;
    }

    public void setLookupCacheConfig(String lookupCacheConfig) {
        this.lookupCacheConfig = lookupCacheConfig;
    }

    public LookupScoreOptions getLookupScoreOptions() {
        return this.lookupScoreOptions;
    }

    public void setLookupScoreOptions(LookupScoreOptions lookupScoreOptions) {
        this.lookupScoreOptions = lookupScoreOptions;
    }

    public @Nullable String getPreferredLanguage() {
        return preferredLanguage;
    }

    /**
     * Set preferred language and validate it. In case validation is failed
     * this method throws look LookupServiceConfigException
     * @param preferredLanguage language tag (or comma-separated list of language tags with decreasing order of preference)
     * of the preferred language(s). A language tag consists of the language and optionally variant, e.g. <code>de</code>
     * or <code>de-CH</code>. See <a href="https://tools.ietf.org/html/rfc4647">RFC4647</a> for details.<br>
     * Examples: <code>en</code>, <code>en,fr-CH,de,ru</code>
     * @throws LookupServiceConfigException
     */
    public void setPreferredLanguage(String preferredLanguage) throws LookupServiceConfigException {
        LanguageHelper.LanguageValidationResults result =
                LanguageHelper.validatePreferredLanguage(preferredLanguage);
        if (result.isValid) {
            this.preferredLanguage = preferredLanguage;
        } else {
            throw new LookupServiceConfigException(
                "lookup:PreferredLanguage has wrong locale format. Error: " + result.errorMessage);
        }
    }

    @Override
    public Resource export(Model model) {
        Resource implNode = super.export(model);

        if (getDatasetId() != null) {
            model.add(implNode, LOOKUP_DATASET_ID, getDatasetId());
        }
        if (getDatasetLabel() != null) {
            model.add(implNode, LOOKUP_DATASET_NAME, VF.createLiteral(getDatasetLabel()));
        }
        if (getLookupCacheConfig() != null) {
            model.add(implNode, LOOKUP_CACHE_CONFIG, VF.createLiteral(getLookupCacheConfig()));
        }
        if (getLookupScoreOptions() != null) {
            model.addAll(CommonLookupConfig.exportLookupScoreOptions(getLookupScoreOptions(), implNode));
        }
        if (getPreferredLanguage() != null) {
            Literal preferredLanguageLiteral = VF.createLiteral(getPreferredLanguage());
            model.add(implNode, LOOKUP_PREFERRED_LANGUAGE, preferredLanguageLiteral);
        }

        return implNode;
    }

    @Override
    public void parse(Model model, Resource resource) throws LookupServiceConfigException {
        super.parse(model, resource);

        Models.objectLiteral(model.filter(resource, LOOKUP_DATASET_NAME, null))
            .ifPresent(literal -> setDatasetLabel(literal.stringValue()));

        Models.objectIRI(model.filter(resource, LOOKUP_DATASET_ID, null))
            .ifPresent(iri -> setDatasetId(iri));

        Models.objectLiteral(model.filter(resource, LOOKUP_CACHE_CONFIG, null))
            .ifPresent(literal -> setLookupCacheConfig(literal.stringValue()));

        Models.objectLiteral(model.filter(resource, LOOKUP_PREFERRED_LANGUAGE, null))
            .map(literal -> literal.stringValue())
            .ifPresent(preferredLanguage -> this.setPreferredLanguage(preferredLanguage));
        this.setLookupScoreOptions(CommonLookupConfig.parseLookupScoreOptions(model, resource));
    }

    /**
     * Parse score options from provided model.
     *
     * @param model model to read from
     * @param resource subject IRI or blank node
     * @return score options or <code>null</code> if no values for either factor or offset were found.
     */
    protected static LookupScoreOptions parseLookupScoreOptions(Model model, Resource resource) {
        Optional<Double> scoreFactor = Models.objectLiteral(model.getStatements(resource, LOOKUP_SCORE_FACTOR, null))
                .map(literal -> literal.doubleValue());
        Optional<Double> scoreOffset = Models.objectLiteral(model.getStatements(resource, LOOKUP_SCORE_OFFSET, null))
                .map(literal -> literal.doubleValue());
        if (scoreFactor.isEmpty() && scoreOffset.isEmpty()) { return null;  }
        return new LookupScoreOptions(scoreFactor.orElseGet(() -> DEFAULT_SCORE_OPTIONS.getScoreFactor()), scoreOffset.orElseGet(() -> DEFAULT_SCORE_OPTIONS.getScoreOffset()));
    }

    protected static List<Statement> exportLookupScoreOptions(@NotNull LookupScoreOptions scoreOptions, Resource resource) {
        List<Statement> statements = new ArrayList<>();
        statements.add(
            VF.createStatement(resource, LOOKUP_SCORE_OFFSET, VF.createLiteral(scoreOptions.getScoreOffset()))
        );
        statements.add(
            VF.createStatement(resource, LOOKUP_SCORE_FACTOR, VF.createLiteral(scoreOptions.getScoreFactor()))
        );
        return statements;
    }
}
