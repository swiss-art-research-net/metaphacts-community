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
package com.metaphacts.config.groups;

import java.util.List;

import javax.annotation.Nullable;
import javax.inject.Inject;

import org.apache.commons.configuration2.PropertiesConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.query.MalformedQueryException;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.sail.SailRepository;
import org.eclipse.rdf4j.sail.memory.MemoryStore;

import com.google.common.collect.Lists;
import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.config.ConfigurationParameter;
import com.metaphacts.config.ConfigurationParameter.VisibilityLevel;
import com.metaphacts.config.ConfigurationParameterHook;
import com.metaphacts.config.InvalidConfigurationException;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.PropertyPattern;
import com.metaphacts.services.storage.api.PlatformStorage;

/**
 * Configuration group for options that affect how data is displayed in the UI.
 *
 * @author Michael Schmidt <ms@metaphacts.com>
 */
public class UIConfiguration extends ConfigurationGroupBase {

    private static final ValueFactory vf = SimpleValueFactory.getInstance();
    private static final IRI metaphactsURI = vf.createIRI("http://www.metaphacts.com");
    private final static String ID = "ui";

    // TODO: outline using locale
    private final static String DESCRIPTION =
            "Configuration properties for options that affect how data is displayed in the UI.";

    /**
     * The default system preferred language tag
     * 
     * @see UIConfiguration#getPreferredLanguages()
     */
    public final static String DEFAULT_LANGUAGE = "en";

    private NamespaceRegistry namespaceRegistry;
    
    @Inject
    public UIConfiguration(PlatformStorage platformStorage, NamespaceRegistry namespaceRegistry) throws InvalidConfigurationException {
        super(ID, DESCRIPTION, platformStorage);
        this.namespaceRegistry = namespaceRegistry;
    }


    /***************************************************************************
     ************************ CONFIGURATION OPTIONS ****************************
     **************************************************************************/

    /**
	 * Returns preferred description property IRIs for rendering resource
	 * description in the UI.
	 *
	 * @return a list of full IRIs enclosed in angle brackets (&lt;&gt;).
	 */
	@ConfigurationParameter(name = "preferredTypes", restartRequired = false, desc = "Ordered list of predicates, property paths and/or graph patterns, "
			+ "which are used to determine the type(s) for IRIs within the application:<br>"
			+ "<ul style=\"list-style-type:none\">\n"
			+ "  <li>(a) full ( surround by &lt;&gt;) or prefixed IRIs or/and </li> \n"
			+ "  <li>(b) a SPARQL property path with full or prefixed IRIs or/and </li>\n"
			+ "  <li>(c) a full SPARQL pattern, which must have a <code>?subject</code> (will be used to inject the entity for which a type should be generated) "
			+ "and a <code>?value</code> (denoting the type value) variable. The entire pattern must be enclosed by curly braces "
			+ "(<code>{ ?subject ?predicate ?value }</code>) and <u>commas must be escaped</u> with a backslash (<code>\\</code>).</li>"
			+ "</ul><b>Example:</b><br>\n"
			+ "<code>rdf:type,&lt;http://www.wikidata.org/prop/direct/P31&gt;</code><br>\n"
			+ "<br>\n"
			+ "<p>Please note that the number and complexity of patterns may heavily influences the performance and load of the application/underlying database.</p>\n"
			+ "Default: rdf:type")
	public List<String> getPreferredTypes() {
		return getStringList("preferredTypes", Lists.newArrayList("<" + RDF.TYPE.stringValue() + ">"));
	}

	/**
	 * Returns preferred label property IRIs for rendering resource labels in the
	 * UI.
	 *
	 * @return a list of full IRIs enclosed in angle brackets (&lt;&gt;).
	 */
    @ConfigurationParameter(name = "preferredLabels", restartRequired = false, desc = "Ordered list of predicates, property paths and/or graph patterns, "
            + "which are used to generate human readable labels for IRIs within the application:<br>"
            + "<ul style=\"list-style-type:none\">\n"
            + "  <li>(a) full ( surround by &lt;&gt;) or prefixed IRIs or/and </li> \n"
            + "  <li>(b) a SPARQL property path with full or prefixed IRIs or/and </li>\n"
            + "  <li>(c) a full SPARQL pattern, which must have a <code>?subject</code> (will be used to inject the entity for which a label should be generated) "
            + "and a <code>?value</code> (denoting the label value) variable. The entire pattern must be enclosed by curly braces "
            + "(<code>{ ?subject ?predicate ?value }</code>) and <u>commas must be escaped</u> with a backslash (<code>\\</code>).</li>"
            + "</ul><b>Example:</b><br>\n"
            + "<code>rdfs:label,&lt;http://www.w3.org/2004/02/skos/core#prefLabel&gt;,a/rdfs:subClassOf/rdfs:label, {OPTIONAL{?subject skos:altLabel ?altLabel.} BIND(COALESCE(?altLabel\\,\"No Label\") as ?value)}</code><br>\n"
            + "<br>\n"
            + "<p>If multiple labels exists for an entity, order of preference is denoted through the order of predicates/patterns in the list. If no label is returned by any of the predicates or patterns, the label service will return the local name of the entity IRI as label. Labels may additionally be ranked by the <code>preferredLanguages</code> setting.</p>\n"
            + "<p>Please note that the number and complexity of patterns may heavily influences the performance and load of the application/underlying database.</p>\n"
            + "Default: rdfs:label")
    public List<String> getPreferredLabels() {
        return getStringList(
            "preferredLabels",
            Lists.newArrayList("<http://www.w3.org/2000/01/rdf-schema#label>")
        );
    }

    /**
     * Returns preferred description property IRIs for rendering resource
     * description in the UI.
     *
     * @return a list of full IRIs enclosed in angle brackets (&lt;&gt;).
     */
    @ConfigurationParameter(name = "preferredDescriptions", restartRequired = false, desc = "Ordered list of predicates, property paths and/or graph patterns, "
            + "which are used to generate HTML description for IRIs within the application:<br>"
            + "<ul style=\"list-style-type:none\">\n"
            + "  <li>(a) full ( surround by &lt;&gt;) or prefixed IRIs or/and </li> \n"
            + "  <li>(b) a SPARQL property path with full or prefixed IRIs or/and </li>\n"
			+ "  <li>(c) a full SPARQL pattern, which must have a <code>?subject</code> (will be used to inject the entity for which a description should be generated) "
			+ "and a <code>?value</code> (denoting the description value) variable. The entire pattern must be enclosed by curly braces "
            + "(<code>{ ?subject ?predicate ?value }</code>) and <u>commas must be escaped</u> with a backslash (<code>\\</code>).</li>"
            + "</ul><b>Example:</b><br>\n"
            + "<code>rdfs:comment,&lt;https://schema.org/description&gt;,a/rdfs:subClassOf/rdfs:comment, {OPTIONAL{?subject rdfs:comment ?description.} BIND(COALESCE(?description\\,\"No description\") as ?value)}</code><br>\n"
            + "<br>\n"
            + "<p>If multiple descriptions exists for an entity, order of preference is denoted through the order of predicates/patterns in the list. Descriptions may additionally be ranked by the <code>preferredLanguages</code> setting.</p>\n"
            + "<p>Please note that the number and complexity of patterns may heavily influences the performance and load of the application/underlying database.</p>\n"
            + "Default: rdfs:comment")
    public List<String> getPreferredDescription() {
        return getStringList(
                "preferredDescriptions",
                Lists.newArrayList("<http://www.w3.org/2000/01/rdf-schema#comment>", "<http://schema.org/description>")
        );
    }

    @ConfigurationParameter(name = "preferredLanguages", restartRequired = false, desc = "Language tag filter over potential <code>preferredLabels</code> candidates. "
            + "Order of preference is denoted through the order of language tags in the list. Default: en")
    public List<String> getPreferredLanguages() {
        return getStringList("preferredLanguages", Lists.newArrayList(DEFAULT_LANGUAGE));
    }

    public String resolvePreferredLanguage(@Nullable String preferredLanguage) {
        if (preferredLanguage != null) {
            return preferredLanguage;
        }
        List<String> systemPreferredLanguages = getPreferredLanguages();
        if (!systemPreferredLanguages.isEmpty()) {
            return systemPreferredLanguages.get(0);
        }
        return DEFAULT_LANGUAGE;
    }

    /**
     * Returns preferred thumbnail property IRIs for rendering resource
     * thumbnail images in the UI.
     *
     * @return a list of full IRIs enclosed in angle brackets (&lt;&gt;).
     */
    @ConfigurationParameter(name = "preferredThumbnails", restartRequired = false, desc = "Ordered list of predicates, property paths and/or graph patterns, "
            + "which are used to generate thumbnails for IRIs within the application:<br>"
            + "<ul style=\"list-style-type:none\">\n"
            + "  <li>(a) full ( surround by ) or prefixed IRIs or/and </li> \n"
            + "  <li>(b) a SPARQL property path with full or prefixed IRIs or/and </li>\n"
            + "  <li>(c) a full SPARQL pattern, which must have a <code>?subject</code> (will be used to inject the entity for which a thumbnail should be generated) "
            + "and a <code>?value</code> (denoting the thumbnail value i.e. URL to the image) variable. "
            + "The entire pattern must be enclosed by curly braces (<code>{ ?subject ?predicate ?value }</code>) and <u>commas must be escaped</u> with a backslash (<code>\\</code>).</li>\n"
            + "</ul>" + "<b>Example:</b><br>\n"
            + "<i>Please refer to the example from the <code>preferredLabels</code> configuration.</i>\n"
            + "<br><br>\n"
            + "<p>If multiple thumbnails exists for an entity, order of preference is denoted through order of predicates/patterns in the list.</p>\n"
            + "<p>Please note that the number and complexity of patterns may heavily influences the performance and load of the application/underlying database.</p>\n"
            + "Default: &lt;http://schema.org/thumbnail&gt;")
    public List<String> getPreferredThumbnails() {
        return getStringList(
            "preferredThumbnails",
            Lists.newArrayList("<http://schema.org/thumbnail>")
        );
    }

    @ConfigurationParameter(name = "templateIncludeQuery", restartRequired = false, desc = "Specifies the SPARQL SELECT query according to which "
            + "the template engine selects templates depending on the request resource / context (i.e. ??).\n"
            + "Query must have at least a \"?type\" projection variable. Default: \"SELECT ?type WHERE{?? a ?type}\"")
    public String getTemplateIncludeQuery() {
        return getString("templateIncludeQuery", "SELECT ?type WHERE { ?? a ?type }");
    }

    @ConfigurationParameter(name = "enableUiComponentBasedSecurity", restartRequired = true, visibilityLevel = VisibilityLevel.experimental)
    public Boolean getEnableUiComponentBasedSecurity() {
        return getBoolean("enableUiComponentBasedSecurity", false);
    }
    
    @ConfigurationParameter(name = "clearScreenOnLogout", restartRequired = true, visibilityLevel = VisibilityLevel.experimental, desc = "Specifies whether to clear the screen and navigate to login screen on session timeout or just show a notifiation and stay at the same screen.")
    public Boolean getClearScreenOnLogout() {
        return getBoolean("clearScreenOnLogout", false);
    }
    
//    @ConfigurationParameter
//    public String getDatePattern() {
//        return getString("datePattern"); // TODO: this is not yet in use
//    }
//
//    @ConfigurationParameter
//    public String getTimePattern() {
//        return getString("timePattern"); // TODO: this is not yet in use
//    }

    @ConfigurationParameter(name = "deploymentTitle", restartRequired = false, desc = "The title of this deployment which is for instance used as title for the currently rendered page.")
    public String getDeploymentTitle() {
        return getString("deploymentTitle", "metaphacts platform");
    }

    // TODO not referenced, consider to deprecate
    @ConfigurationParameter(name = "unsupportedBrowserMessage", restartRequired = false, visibilityLevel = VisibilityLevel.experimental)
    public String getUnsupportedBrowserMessage() { return getString("unsupportedBrowserMessage", ""); }

    /**
     * Returns supported web browsers in the format BrowserName-MinimumVersion, e.g. Chrome-58
     *
     * @return a list of supported browsers and their minimum version numbers.
     */
    // TODO not referenced, consider to deprecate
    @ConfigurationParameter(name = "supportedBrowsers", restartRequired = false, visibilityLevel = VisibilityLevel.experimental)
    public List<String> getSupportedBrowsers() {
        return getStringList("supportedBrowsers", Lists.newArrayList());
    }

    /**
     * Returns list of unsupported web browsers, e.g. "Edge", "Opera", "Safari", "Chrome", "IE11", "Firefox", "Other"
     * @return list of unsupported browsers.
     */
    @ConfigurationParameter(
        name = "unsupportedBrowsers",
        restartRequired = false,
        desc = " Returns list of unsupported web browsers, e.g. \"Edge\", \"Opera\", \"Safari\", \"Chrome\", \"IE11\", \"Firefox\", \"Other\"",
        visibilityLevel = VisibilityLevel.experimental
    )
    public List<String> getUnsupportedBrowsers() {
        return getStringList("unsupportedBrowsers", Lists.newArrayList("IE11"));
    }

    /****************************** VALIDATION ********************************/
    @Override
    public void assertConsistency() {
        // we can't use 'getPreferredLabels' to check consistency
        // because it depends on NamespaceRegistry which is not initialized when
        // assertConsistency is called
        if (getPreferredLanguages().isEmpty()) {
            throw new IllegalArgumentException("getPreferredLanguages must not be empty.");
        }
    }
    
    @ConfigurationParameterHook(forSetting = "preferredTypes")
    public void onUpdatePreferredType(String configIdInGroup, List<String> configValues, PropertiesConfiguration targetConfig) throws ConfigurationException {
        checkPropertyPatterns("preferredTypes", configValues);
    }
    
    @ConfigurationParameterHook(forSetting = "preferredLabels")
    public void onUpdatePreferredLabels(String configIdInGroup, List<String> configValues, PropertiesConfiguration targetConfig) throws ConfigurationException {
        checkPropertyPatterns("preferredLabels", configValues);
    }

    @ConfigurationParameterHook(forSetting = "preferredDescriptions")
    public void onUpdatePreferredDescriptions(String configIdInGroup, List<String> configValues, PropertiesConfiguration targetConfig) throws ConfigurationException {
        checkPropertyPatterns("preferredDescriptions", configValues);
    }

    @ConfigurationParameterHook(forSetting = "preferredThumbnails")
    public void onUpdatePreferredThumbnails(String configIdInGroup, List<String> configValues, PropertiesConfiguration targetConfig) throws ConfigurationException {
        checkPropertyPatterns("preferredThumbnails", configValues);
    }
    
    protected void checkPropertyPatterns(String configProperty, List<String> configValues) throws ConfigurationException {
        try {
            for (String singlePropertyPattern : configValues) {
                PropertyPattern.parse(singlePropertyPattern, namespaceRegistry);
            }
        } catch (MalformedQueryException e) {
            throw new ConfigurationException("The \"" + configProperty + "\" that you have entered is invalid. Please add a valid value. \n Details: " +e.getMessage());
        }
    }

    @ConfigurationParameterHook(forSetting = "templateIncludeQuery")
    public void onUpdateTemplateIncludeQuery(String configIdInGroup, List<String> configValues, PropertiesConfiguration targetConfig) throws ConfigurationException {
        if (configValues.size() != 1) {
            throw new ConfigurationException(
                    "The parameter \"templateIncludeQuery\" must point to a single valid query.");
        }

        String queryString = configValues.get(0);

        SparqlOperationBuilder<TupleQuery> builder = SparqlOperationBuilder.create(queryString, TupleQuery.class);
        Repository db = new SailRepository(new MemoryStore());
        db.init();

        try(RepositoryConnection con = db.getConnection()){

            TupleQueryResult tqr = builder.resolveThis(metaphactsURI).build(con).evaluate();
            if(!tqr.getBindingNames().contains("type")) { 
                throw new ConfigurationException("Query as specified in \"templateIncludeQuery\" config for extracting the wiki include types must return a binding with name \"type\"");
            }
        } catch (MalformedQueryException e) {
            throw new ConfigurationException("The query that you have entered is invalid. Please add a valid query. \n Details: " +e.getMessage());
        } finally {
            db.shutDown();
        }
    }
}
