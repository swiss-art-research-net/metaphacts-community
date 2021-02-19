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
package com.metaphacts.resource;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import javax.annotation.Nullable;
import javax.inject.Inject;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.BNode;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Triple;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.repository.Repository;

import com.github.jknack.handlebars.Context;
import com.github.jknack.handlebars.EscapingStrategy;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.ValueResolver;
import com.github.jknack.handlebars.cache.ConcurrentMapTemplateCache;
import com.google.common.collect.Maps;
import com.metaphacts.cache.LabelService;
import com.metaphacts.cache.LiteralCache;
import com.metaphacts.config.groups.UIConfiguration;
import com.metaphacts.templates.TemplateUtil;
import com.metaphacts.templates.helper.DateTimeHelperSource;
import com.metaphacts.util.LanguageHelper;
import com.metaphacts.util.Orderable;
import com.metaphacts.util.OrderableComparator;

/**
 * DescriptionRenderer using a Handelbars template and the provided resource
 * description.
 * 
 * <p>
 * A "one-line" textual description of an entity is created by rendering a
 * Handlebars template with the description properties provided as input.
 * </p>
 * 
 * <p>
 * The renderer fetches a Handlebars template from the provided
 * {@link DescriptionTemplateProvider} and renders it with the model created
 * from the provided property values from the instance description. Each
 * property is passed to the model with its
 * {@link PropertyValue#getPropertyId()} as variable name, the values are
 * provided as list.<br>
 * Additionally, the generic properties {@value #MODEL_LABEL} and
 * {@value #MODEL_TYPE} are provided.
 * </p>
 * 
 * <p>
 * Variables and expressions are enclosed in <code>[[ ... ]]</code>. To avoid
 * HTML escaping triple-braces can be used: <code>[[[ ... ]]]</code>
 * </p>
 * 
 * <p>
 * Besides the default Handlebars helpers also the methods provided by
 * {@link DateTimeHelperSource} are available.
 * </p>
 * 
 * 
 * <p>
 * Example of a template:<br>
 * <code>[[[label]]] ([[[type]]]): [[occupation.0.value]] ([[dateOfBirth.0.value]])[[#if marriedTo]], married to [[marriedTo.0.value]][[/if]]</code>
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class HandlebarsDescriptionRenderer implements DescriptionRenderer, Orderable {
    private static final String MODEL_LABEL = "label";
    private static final String MODEL_TYPE = "type";
    public static final String startDelimiter = "[[";
    public static final String endDelimiter = "]]";

    static final Logger logger = LogManager.getLogger(HandlebarsDescriptionRenderer.class);

    protected Handlebars handlebars;
    protected DescriptionTemplateByIriLoader templateLoader;
    protected LabelService labelService;

    public HandlebarsDescriptionRenderer() {
    }

    @Inject
    public void setTemplateLoader(DescriptionTemplateByIriLoader templateLoader) {
        this.templateLoader = templateLoader;
        this.handlebars = createHandlebars(templateLoader);
    }

    @Inject
    public void setLabelService(LabelService labelService) {
        this.labelService = labelService;
    }

    protected Handlebars createHandlebars(DescriptionTemplateByIriLoader templateLoader) {
        // make template cache reloadable, i.e. it checks whether the template file has
        // changed and needs reloading.
        ConcurrentMapTemplateCache templateCache = new ConcurrentMapTemplateCache();
        templateCache.setReload(true);

        // @formatter:off
        return new Handlebars()
            .with(templateCache)
            .with(templateLoader)
            .with(EscapingStrategy.NOOP)    // for pure text rendering we don't want to escape anything
            .startDelimiter(startDelimiter)
            .endDelimiter(endDelimiter)
            .registerHelpers(DateTimeHelperSource.class)
            ;
        // @formatter:on
    }

    @Override
    public boolean canRenderDescription(IRI typeIRI) {
        if (templateLoader == null || handlebars == null) {
            return false;
        }

        String templateLocation = TemplateUtil.convertResourceToTemplateIdentifier(typeIRI);
        return templateLoader.hasDescriptionTemplate(templateLocation);
    }

    @Override
    public Optional<String> renderTemplate(ResourceDescription instanceDescription, Repository repository,
            @Nullable String preferredLanguage) {
        IRI typeIRI = instanceDescription.getTypeDescription().getTypeIRI();
        String templateLocation = TemplateUtil.convertResourceToTemplateIdentifier(typeIRI);
        logger.trace("Rendering template '{}' for resource {}", templateLocation,
                instanceDescription.getResource().stringValue());
        return renderTemplate(templateLocation, instanceDescription, repository, preferredLanguage);
    }

    protected Optional<String> renderTemplate(String templateLocation, ResourceDescription instanceDescription,
            Repository repository, String preferredLanguage) {
        if (templateLoader == null || handlebars == null) {
            return Optional.empty();
        }
        try {
            Resource resource = instanceDescription.getResource();
            Template template = handlebars.compile(templateLocation);
            Map<String, ?> model = createModel(instanceDescription, repository, preferredLanguage);
            Object context = Context.newBuilder(resource).combine(model).push(new RDF4JValueResolver()).build();
            return Optional.of(template.apply(context));
        } catch (Exception e) {
            logger.warn("Failed to load or render template '{}': {}", templateLocation, e.getMessage());
            logger.debug("Details: ", e);
        }
        return Optional.empty();
    }

    protected Map<String, Object> createModel(ResourceDescription instanceDescription, Repository repository,
            String preferredLanguage) {
        Map<String, Object> model = Maps.newHashMap();

        Optional.ofNullable(instanceDescription.getLabel())
            .ifPresent(label -> model.put(MODEL_LABEL, label));
        Optional.ofNullable(instanceDescription.getTypeDescription())
            .map(typeDescription -> typeDescription.getTypeIRI())
                .map(type -> labelFor(type, repository, preferredLanguage)).map(type -> type.stringValue())
            .ifPresent(type -> model.put(MODEL_TYPE, type));

        List<PropertyValue> descriptionProperties = instanceDescription.getDescriptionProperties();
        descriptionProperties
                .forEach(prop -> model.put(prop.getPropertyId(),
                        convertValues(prop.getValues(), repository, preferredLanguage)));

        return model;
    }

    /**
     * Convert property values to a format suitable for rendering.
     * <p>
     * <ul>
     * <li>when a {@code preferredLanguage} is provided and all values are literals
     * with at least one having a language tag, we treat it as a list of
     * multi-lingual labels and choose only one of them best matching the provided
     * set of preferred language(s)</li>
     * <li>otherwise return all values, but IRIs are replaced with their labels (as
     * {@link Literal}) as returned by the provided {@link LabelService}. This again
     * uses the preferred language to resolve the labels.</li>
     * </ul>
     * </p>
     * 
     * @param values            list of values to convert
     * @param repository        repository from which to fetch any additional
     *                          resource labels
     * @param preferredLanguage (optional) language tag (or comma-separated list of
     *                          language tags with decreasing order of preference)
     *                          of the preferred language(s). A language tagы
     *                          consists of the language and optionally variant,
     *                          e.g. <code>de</code> or <code>de-CH</code>. See
     *                          <a href=
     *                          "https://tools.ietf.org/html/rfc4647">RFC4647</a>
     *                          for details.<br>
     *                          Examples: <code>en</code>,
     *                          <code>en,fr-CH,de,ru</code>.
     * @return
     */
    protected List<Value> convertValues(List<Value> values, Repository repository,
            @Nullable String preferredLanguage) {
        if (values == null) {
            return Collections.emptyList();
        }

        // check if all values are literals and if so we have at least one language tag
        boolean allLiterals = true;
        boolean hasLanguageTag = false;
        boolean hasIRIs = false;
        for (Value value : values) {
            if (value.isLiteral()) {
                Literal literal = (Literal) value;

                if (literal.getLanguage().isPresent()) {
                    // at least one language tag
                    hasLanguageTag = true;
                }
            } else {
                // at least one non-literal, abort here
                allLiterals = false;
            }
            if (value instanceof IRI) {
                hasIRIs = true;
            }
        }
        if (allLiterals && hasLanguageTag) {
            // only literal values and at least one string with language tag
            // -> treat as list of multi-lingual labels and choose one of them only
            List<Literal> literals = values.stream().map(v -> (Literal) v).collect(Collectors.toList());
            Optional<Literal> labelWithPreferredLanguage = LiteralCache.chooseLabelWithPreferredLanguage(literals,
                    LanguageHelper.getPreferredLanguage(preferredLanguage).orElse(UIConfiguration.DEFAULT_LANGUAGE),
                    LanguageHelper.getPreferredLanguages(preferredLanguage));
            if (labelWithPreferredLanguage.isPresent()) {
                return Collections.singletonList(labelWithPreferredLanguage.get());
            }
        }

        if (hasIRIs) {
            // we replace IRIs with their labels, literals are returned unchanged
            return values.stream().map(value -> {
                if (value.isIRI()) {
                    // replace IRI with label for rendering
                    IRI iri = (IRI) value;
                    return labelFor(iri, repository, preferredLanguage);
                } else {
                    // return any other element unchanged
                    return value;
                }
            }).collect(Collectors.toList());
        } else {
            // return list of values unchanged
            return values;
        }
    }

    /**
     * Fetch label for provided resource. This method delegates to the
     * {@link LabelService}.
     */
    protected Value labelFor(IRI iri, Repository repository, String preferredLanguage) {
        Optional<Literal> label = labelService.getLabel(iri, repository, preferredLanguage);
        return LiteralCache.resolveLiteralWithFallback(label, iri);
    }

    @Override
    public int getOrder() {
        return OrderableComparator.MIDDLE;
    }

    /**
     * Handlebars value resolver for sub-properties of an RDF4J value.
     * 
     * <p>
     * This value resolver implement fields as defined in rdf.js, see
     * <a href="https://rdf.js.org/data-model-spec/#data-interfaces">RDF.JS data
     * model spec</a>.
     * </p>
     * 
     * <p>
     * This corresponds to what is available in our frontend rendering, i.e. allows
     * to use {@code variable.value} to get a value's or literal's string
     * representation.
     * </p>
     */
    static class RDF4JValueResolver implements ValueResolver {

        @Override
        public Object resolve(Object context, String name) {
            if (context instanceof Value) {
                Value value = (Value) context;
                switch (name) {
                case "value":
                    return value.stringValue();
                case "localName":
                    return (value instanceof IRI ? ((IRI) value).getLocalName() : null);
                case "namespace":
                    return (value instanceof IRI ? ((IRI) value).getNamespace() : null);
                case "language":
                    return (value instanceof Literal ? ((Literal) value).getLanguage() : null);
                case "datatype":
                    return (value instanceof Literal ? ((Literal) value).getDatatype() : null);
                case "termType":
                    if (value instanceof Literal) {
                        return "Literal";
                    }
                    if (value instanceof Triple) {
                        return "Quad";
                    }
                    if (value instanceof BNode) {
                        return "BlankNode";
                    }
                    if (value instanceof IRI) {
                        return "NamedNode";
                    }
                    return null;
                }
            }
            return UNRESOLVED;
        }

        @Override
        public Object resolve(Object context) {
            if (context instanceof Value) {
                Value value = (Value) context;
                return value.stringValue();

            }
            return UNRESOLVED;
        }

        @Override
        public Set<Entry<String, Object>> propertySet(Object context) {
            return Collections.emptySet();
        }
    }
}
