import {
    Rdf, ElementModel, LinkModel, ElementIri, ElementTypeIri, LinkIri, LinkTypeIri, PropertyTypeIri,
    MetadataApi, ValidationApi, ValidationEvent, ElementError, LinkError, CancellationToken,
} from '../../src/ontodia/index';

const OWL_PREFIX = 'http://www.w3.org/2002/07/owl#';
const RDFS_PREFIX = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD_PREFIX = 'http://www.w3.org/2001/XMLSchema#';

const owl = {
    class: OWL_PREFIX + 'Class' as ElementTypeIri,
    objectProperty: OWL_PREFIX + 'ObjectProperty' as ElementTypeIri,
    domain: OWL_PREFIX + 'domain' as LinkTypeIri,
    range: OWL_PREFIX + 'range' as LinkTypeIri,
};
const rdfs = {
    subClassOf: RDFS_PREFIX + 'subClassOf' as LinkTypeIri,
    subPropertyOf: RDFS_PREFIX + 'subPropertyOf' as LinkTypeIri,
};
const example = {
    multiProperty: 'http://example.com/schema/multiProperty' as LinkTypeIri,
};

function hasType(model: ElementModel, type: ElementTypeIri) {
    return Boolean(model.types.find(t => t === type));
}

const SIMULATED_DELAY: number = 500; /* ms */

interface Relation {
    readonly source: ElementTypeIri;
    readonly target: ElementTypeIri;
    readonly type: LinkTypeIri;
    readonly editable?: boolean;
}
const EDITABLE_RELATIONS: ReadonlyArray<Relation> = [
    {source: owl.class, target: owl.class, type: rdfs.subClassOf},
    {source: owl.class, target: owl.class, type: example.multiProperty, editable: true},
    {source: owl.objectProperty, target: owl.class, type: owl.domain},
    {source: owl.objectProperty, target: owl.class, type: owl.range},
    {source: owl.objectProperty, target: owl.objectProperty, type: rdfs.subPropertyOf},
];

export class ExampleMetadataApi implements MetadataApi {
    async canConnect(
        element: ElementModel,
        another: ElementModel | null,
        linkType: LinkTypeIri | null,
        ct: CancellationToken
    ): Promise<boolean> {
        await delay(SIMULATED_DELAY, ct);
        for (const relation of EDITABLE_RELATIONS) {
            if (!linkType || relation.type === linkType) {
                if (hasType(element, relation.source) && (!another || hasType(another, relation.target))) {
                    return true;
                }
                if (hasType(element, relation.target) && (!another || hasType(another, relation.source))) {
                    return true;
                }
            }
        }
        return false;
    }

    async possibleLinkTypes(
        source: ElementModel, target: ElementModel, ct: CancellationToken
    ): Promise<LinkTypeIri[]> {
        await delay(SIMULATED_DELAY, ct);
        const linkTypes = new Set<LinkTypeIri>();
        for (const relation of EDITABLE_RELATIONS) {
            if (hasType(source, relation.source) && hasType(target, relation.target)) {
                linkTypes.add(relation.type);
            }
        }
        return Array.from(linkTypes);
    }

    async typesOfElementsDraggedFrom(source: ElementModel, ct: CancellationToken): Promise<ElementTypeIri[]> {
        await delay(SIMULATED_DELAY, ct);
        const elementTypes = new Set<ElementTypeIri>();
        for (const relation of EDITABLE_RELATIONS) {
            if (hasType(source, relation.source)) {
                elementTypes.add(relation.target);
            }
            if (hasType(source, relation.target)) {
                elementTypes.add(relation.source);
            }
        }
        return Array.from(elementTypes);
    }

    async propertiesForType(type: ElementTypeIri, ct: CancellationToken): Promise<PropertyTypeIri[]> {
        await delay(SIMULATED_DELAY, ct);
        return [];
    }

    async filterConstructibleTypes(
        types: ReadonlySet<ElementTypeIri>, ct: CancellationToken
    ): Promise<ReadonlySet<ElementTypeIri>> {
        await delay(SIMULATED_DELAY, ct);
        const result = new Set<ElementTypeIri>();
        types.forEach(type => {
            if (type.length % 2 === 0) {
                result.add(type);
            }
        });
        return result;
    }

    async canDeleteElement(element: ElementModel, ct: CancellationToken): Promise<boolean> {
        await delay(SIMULATED_DELAY, ct);
        return true;
    }

    async canEditElement(element: ElementModel, ct: CancellationToken): Promise<boolean> {
        await delay(SIMULATED_DELAY, ct);
        return true;
    }

    async canDeleteLink(
        link: LinkModel, source: ElementModel, target: ElementModel, ct: CancellationToken
    ): Promise<boolean> {
        await delay(SIMULATED_DELAY, ct);
        return true;
    }

    async canEditLink(
        link: LinkModel, source: ElementModel, target: ElementModel, ct: CancellationToken
    ): Promise<boolean> {
        await delay(SIMULATED_DELAY, ct);
        return true;
    }

    async generateNewElement(types: ReadonlyArray<ElementTypeIri>, ct: CancellationToken): Promise<ElementModel> {
        await delay(SIMULATED_DELAY, ct);
        const random32BitDigits = Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
        return {
            id: `${types[0]}_${random32BitDigits}` as ElementIri,
            types: [...types],
            label: {values: [Rdf.OntodiaDataFactory.literal('New Entity')]},
            properties: {},
        };
    }

    async generateNewLink(
        source: ElementModel,
        target: ElementModel,
        linkType: LinkTypeIri,
        ct: CancellationToken,
    ): Promise<LinkModel> {
        await delay(SIMULATED_DELAY, ct);
        let linkIri: LinkIri | undefined;
        const properties: LinkModel['properties'] = {};
        if (EDITABLE_RELATIONS.find(r => r.type === linkType && r.editable)) {
            const random32BitDigits = Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
            linkIri = `${linkType}_${random32BitDigits}` as LinkIri;
            properties['http://example.com/schema/uniqueIndex'] = {
                values: [Rdf.OntodiaDataFactory.literal(String(random32BitDigits), XSD_PREFIX + 'integer')],
            };
        }
        return {
            sourceId: source.id,
            targetId: target.id,
            linkTypeId: linkType,
            linkIri,
            properties,
        };
    }
}

export class ExampleValidationApi implements ValidationApi {
    async validate(event: ValidationEvent): Promise<Array<ElementError | LinkError>> {
        const errors: Array<ElementError | LinkError> = [];
        if (event.target.types.indexOf(owl.class) >= 0) {
            event.state.links.forEach(e => {
                if (!e.before && e.after.sourceId === event.target.id) {
                    errors.push({
                        type: 'link',
                        target: e.after,
                        message: 'Cannot add any new link from a Class',
                    });
                    const linkType = event.model.createLinkType(e.after.linkTypeId);
                    errors.push({
                        type: 'element',
                        target: event.target.id,
                        message: `Cannot create <${linkType.id}> link from a Class`,
                    });
                }
            });
        }

        await delay(SIMULATED_DELAY, event.cancellation);
        return errors;
    }
}

async function delay(amountMs: number, ct: CancellationToken) {
    CancellationToken.throwIfAborted(ct);
    await waitTimeout(amountMs);
    CancellationToken.throwIfAborted(ct);
}

function waitTimeout(amountMs: number): Promise<void> {
    if (amountMs === 0) {
        return Promise.resolve();
    }
    return new Promise(resolve => setTimeout(resolve, amountMs));
}
