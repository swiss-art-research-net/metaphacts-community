> :warning: **Note**
This is a fork of [https://bitbucket.org/metaphacts/metaphacts-community/src/master/metaphacts-platform/](). 
>
>
> The Docker image is published as **swissartresearx/metaphacts-community:x.x.x**
>
> Build:
> `./build.sh  -DbuildEnv=prod -Dbuildjson=./metaphacts-platform/platform-only-root-build.json   -DplatformVersion=x.x.x platformWar`



# metaphacts Semantic Platform for Cultural Heritage and Digital Humanities

The metaphacts platform provides a comprehensive platform to publish research data modelled using the [CIDOC-CRM](http://www.cidoc-crm.org/) ontology for [Cultural Heritage](https://en.wikipedia.org/wiki/Cultural_heritage) and [Digital Humanities](https://en.wikipedia.org/wiki/Digital_humanities) in the Galeries, Libraries, Archives and Museums [(GLAM) sector](https://en.wikipedia.org/wiki/GLAM_(industry_sector)).

For examples see the list of demos and public projects at the bottom of this page.

## Use Cases

### Semantic Web Database

* Definition of new patterns of knowledge using [CIDOC-CRM](http://www.cidoc-crm.org/) to capture contextual details based on expert requirements

* Authoring of ontology and instance data for better model management and data quality assurance

* Ability to integrate patterns of knowledge into search and visualization components using metadata

* Ability to share knowledge patterns with the community

### Semantic Search

* Semantic search across heterogeneous datasets using contextual relationships

* Simple text search components featuring auto-completion and semantic disambiguation

* Interactive expert search system based on a user-friendly graphical interface for query construction

* Search functions across spatial and temporal dimensions

* Intelligent semantic clipboard allowing users to save searches and search results to their personalized research space, create own datasets, create arguments, and underpin narratives - all of this privately or collaboratively

### Semantic Annotations & Narratives

* Innovative functionalities to support text-based annotations, represent assertions, and create general narratives backed up by semi-formalized arguments with clear data provenance

* Ability to track the development of arguments and assertions over time

* Functionalities to visualize narratives and create digital essays that are related to the resources they reference

* Semantic annotation of images leveraging the IIIF standard for streaming high-resolution images



## Partners and Users of the Platform

[![Consortium for Open Research Data in the Humanities](https://metaphacts.com/images/bitbucket/CORDH.png)](https://www.cordh.net)
[![Bibliotheca Hertziana – Max Planck Institute for Art History (BHMPI)](https://metaphacts.com/images/bitbucket/BHMPI.png)](https://www.biblhertz.it/)
[![Villa I Tatti, The Harvard University Center for Italian Renaissance Studies](https://metaphacts.com/images/bitbucket/ITATTI.png)](http://itatti.harvard.edu/)
[![Max Planck Institute for the History of Science (MPIWG)](https://metaphacts.com/images/bitbucket/MPIWG.png)](https://www.mpiwg-berlin.mpg.de/)
[![The International Consortium of Photo Archives](https://metaphacts.com/images/bitbucket/Pharos.png)](http://pharosartresearch.org/)
[![Swiss Archive of Performing Arts (SAPA)](https://metaphacts.com/images/bitbucket/SAPA.png)](https://sapa.swiss/)
[![SARI - The Swiss Art Research Infrastructure](https://metaphacts.com/images/bitbucket/SARI.png)](https://swissartresearch.net/)
[![ETH Zürich](https://metaphacts.com/images/bitbucket/ETH.png)](https://ethz.ch/)
[![Universität Zürich](https://metaphacts.com/images/bitbucket/UZH.png)](https://www.uzh.ch/)
[![The Parthenos Project](https://metaphacts.com/images/bitbucket/PARTHENOS.png)](http://www.parthenos-project.eu/)

## Technology

The metaphacts platform provides building blocks for building semantic web applications around [Knowledge Graphs](https://en.wikipedia.org/wiki/Knowledge_Graph). Examples for well-known public knowledge graphs are [Wikidata](https://www.wikidata.org/) or [DBpedia](https://wiki.dbpedia.org/), but there are also many non-public Enterprise Knowledge Graphs.

[Cultural Heritage](https://en.wikipedia.org/wiki/Cultural_heritage) and [Digital Humanities](https://en.wikipedia.org/wiki/Digital_humanities) data sets are typically modelled using the [CIDOC Conceptual Reference Model](http://www.cidoc-crm.org/) ontology as the knowledge representation system, although other conceptual reference models can also be implemented.

### Technical Overview

See [Development Instructions](DEVELOPMENT.md) for details on source code structure and how to build the platform.

### Built on open standards

The platform is built on open standards and technologies:

* Semantic Web standards defined by the [W3C](https://www.w3.org/) and other organizations such as the [Resource Description Format (RDF)](https://www.w3.org/RDF/), the [SPARQL Query Language](https://www.w3.org/TR/rdf-sparql-query/), the [Web Ontology Language](https://www.w3.org/OWL/), and the [Linked Data Platform](https://www.w3.org/TR/ldp/)

* Data sets are typically modelled using the [CIDOC Conceptual Reference Model](http://www.cidoc-crm.org/) ontology or using the [Simple Knowledge Organization System (SKOS)](https://www.w3.org/2004/02/skos/)

* Web standards such as [HTML5](https://html.spec.whatwg.org/), [Web Components](https://www.webcomponents.org/)

* Widely used technologies such as the [Java](https://www.oracle.com/java/technologies/) programming language, Web Services and [REST APIs](https://en.wikipedia.org/wiki/Representational_state_transfer)

## Contributors and Acknowledgements

Many thanks to the following organizations for contributions and funding:

* [ResearchSpace](https://www.researchspace.org/), a project funded by the [Andrew W. Mellon Foundation](https://mellon.org) working in partnership with the [British Museum](https://www.britishmuseum.org)

* [BHMPI - Bibliotheca Hertziana – Max Planck Institute for Art History](https://www.biblhertz.it/)

* [Villa I Tatti, The Harvard University Center for Italian Renaissance Studies](http://itatti.harvard.edu/)

* [MPIWG - Max Planck Institute for History of Science](https://www.mpiwg-berlin.mpg.de/)

* [SARI - The Swiss Art Research Infrastructure](https://swissartresearch.net/)

* [ETH Zürich](https://ethz.ch/)

* [UZH - Uni Zürich](https://www.uzh.ch/)

Also see [CONTRIBUTORS](metaphacts-platform/CONTRIBUTORS.md).


## License

The metaphacts platform is released under the [LGPL 2.1 + Commons Clause](LICENSE.txt).

## Binaries

Docker images are available from Docker Hub at https://hub.docker.com/r/metaphacts/glam-community

## Contributions

Contributing to the platform is possible with a signed Contributor Licensing Agreement. Please see [Contributing](CONTRIBUTING.md) and/or reach out to us for details.

## Support and Commercial Services

metaphacts offers commercial support for the platform in the form of developer and production support subscriptions. Please contact info@metaphacts.com for details.

Some use cases might need extensions or additional features. metaphacts offers custom development to support these use cases. Please contact info@metaphacts.com to enquire about options.

## Demos & Public Projects

The metaphacts platform is used by many organisations to implement a wide variety of use cases. This section provides some examples and links to publicly accessible projects or demo systems.

### Sphaera CorpusTracer (MPIWG)

The [Sphaera CorpusTracer](https://sphaera.mpiwg-berlin.mpg.de/) ([demo system](http://db.sphaera.mpiwg-berlin.mpg.de/resource/Start), [paper](https://academic.oup.com/dsh/article/33/2/336/4085304)) project reconstructs the transformation process of the original treatise 'Tractatus de sphaera' by Johannes de Sacrobosco & explores the evolutionary path of the scientific system pivoted around  cosmological knowledge by:

* Cataloguing text parts and context to trace how certain parts have been disseminated

* Determining how successful certain texts were and how the knowledge conveyed in those texts was spread in space and time

* Identifying the roles, relationships and social context of different actors

[![Sphaera CorpusTracer](https://metaphacts.com/images/bitbucket/corpustracer_small.png)](https://metaphacts.com/images/bitbucket/corpustracer.png)
[![Semantic Web Database](https://metaphacts.com/images/bitbucket/semantic-web-database_small.png)](https://metaphacts.com/images/bitbucket/semantic-web-database.png)


### Digital Research Infrastructure (MPIWG)

The [Digital Research Infrastructure](https://www.mpiwg-berlin.mpg.de/research/projects/digital-research-infrastructure) establishes a common technical standard and best-practices for digital research in the humanities. While it is derived from the specific knowledge economy at the MPIWG, it makes use of existing standards, technologies and APIs. It is generic enough to be implemented and adapted by other institutions with similar digital research needs.


### Art & Architecture Thesaurus Translation Service (AAT) (Swiss Art Research Infrastructure)

The [Art & Architecture Thesaurus Translation Service](https://aat.swissartresearch.net/) aims at enabling specialised research institutions and cultural heritage institutions to mutually tap into a decentralised service for linking digital image resources, research results and metadata in the field of art history and related disciplines.

This is achieved by:

* Using multi-lingual reference data vocabularies and metadata standards to enable mutual exchange and referencing of digital resources across linguistic and national borders

* Building a cross-institutional research environment which links actors with diverse scholarly and institutional orientations

[![Art & Architecture Thesaurus Translation Service (AAT)](https://metaphacts.com/images/bitbucket/aat-gastronomy_small.png)](https://metaphacts.com/images/bitbucket/aat-gastronomy.png)

### Reference Data Service (RDS) (Swiss Art Research Infrastructure)

The [Reference Data Service](https://rds-dev.swissartresearch.net/) aims to provide a unified and fast access to reference data and, thus to enhance the user's look-up process for commonly used terms and vocabularies.

[![Reference Data Service (RDS)](https://metaphacts.com/images/bitbucket/SARI-Reference-Data-Service_small.png)](https://metaphacts.com/images/bitbucket/SARI-Reference-Data-Service.png).

### Photographic Knowledge of History of Arts (University of Zürich)

The project [Photographic Knowledge of History of Arts](https://fw.swissartresearch.net/) (_Rechercheportal Fotografisches Wissen der Kunstgeschichte_)  provides research data regarding the collection of historic slides of the History of Arts Institute of the University of Zürich.

[![Fotografisches Wissen der Kunstgeschichte](https://metaphacts.com/images/bitbucket/Fotografisches-Wissen-der-Kunstgeschichte_small.png)](https://metaphacts.com/images/bitbucket/Fotografisches-Wissen-der-Kunstgeschichte.png)

### gta Research Portal (ETH Zürich)

The [gta Archive](https://archiv.gta.arch.ethz.ch/about/about-us) at ETH Zurich is Switzerland’s most renown architectural archive and one of the most important by international comparison. It holds unique collections of historical documents in the fields of architecture and architectural theory, engineering, design, local, regional and national planning, garden architecture and landscape architecture from the mid-nineteenth century to the present day.

The [gta Research Portal](https://grp.swissartresearch.net/) allows not only for unified access to the gta Archives’ collections data and digitised visual research resources but also to research data from related research projects, such as [Experimental Design in the Post-War Period](https://stalder.arch.ethz.ch/researchprojects/experimental-design-in-the-postwar-period-heinz-islers-19262009-contribution-in-the-perspective-of-the-history-of-engineering-and-culture). By allowing both human-interpretable and machine-processable access by way of the semantic web (based on Linked Open Data) and by consistently implementing scholarly acknowledged, yet open standards for data modelling and data exchange, the gta Research Portal provides unique and unprecedented access to these most valuable research resources to the international academic community for further research and re-use. By integrating the data into established research portals (such as the ETH Library Search Portal), the gta Archives’ holdings will also be made visible to a broader public outside the ETH Zurich.

[![gta Research Portal](https://metaphacts.com/images/bitbucket/gta-Research-Portal_small.png)](https://metaphacts.com/images/bitbucket/gta-Research-Portal.png)

### PARTHENOS Entities Dataspace

The [PARTHENOS](https://www.oeaw.ac.at/acdh/projects/completed-projects/parthenos/) [Entities Dataspace](https://parthenos.acdh.oeaw.ac.at/) contains metadata from all partner Research Infrastructures which is aggregated here under a common semantic model, allowing for unprecedented interdisciplinary view on these hetereogeneous datasets.

[![Parthenos Discovery](https://metaphacts.com/images/bitbucket/PARTHENOS-Discovery_small.png)](https://metaphacts.com/images/bitbucket/PARTHENOS-Discovery.png)

### Mingei (FORTH)

[Mingei](http://www.mingei-project.eu/) will explore the possibilities of representing and making accessible both tangible and intangible aspects of craft as cultural heritage (CH). Heritage Crafts (HCs) involve craft artefacts, materials, and tools and encompass craftsmanship as a form of Intangible Cultural Heritage. Intangible HC dimensions include dexterity, know-how, and skilled use of tools, as well as tradition and identity of the communities in which they are, or were, practiced. HCs are part of the history and have impact upon the economy of the areas in which they flourish. The significance and urgency to the preservation of HCs is underscored, as several are threatened with extinction.

Despite their cultural significance, efforts for HC representation and preservation are scattered geographically and thematically. Mingei will provide means to establish HC representations based on digital assets, semantics, existing literature and repositories, as well as mature digitisation and representation technologies. These representations will capture and preserve tangible and intangible dimensions of HCs.

[![Mingei Home](https://metaphacts.com/images/bitbucket/FORTH-Mingei-home_small.png)](https://metaphacts.com/images/bitbucket/FORTH-Mingei-home.png)
[![Mingei narrative](https://metaphacts.com/images/bitbucket/FORTH-Mingei-narrative_small.png)](https://metaphacts.com/images/bitbucket/FORTH-Mingei-narrative.png)

## Get in contact

Please get in contact with metaphacts at info@metaphacts.com, we are interested in use cases and examples!
