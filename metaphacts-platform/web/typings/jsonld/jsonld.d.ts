declare module JsonLd {
  interface JsonLdValue {
    '@value': any;
    '@type'?: string;
    '@language'?: string;
    '@id'?: string;
  }
  interface JsonLdStatic {
    documentLoaders: any;
    documentLoader: (url: string) => PromiseLike<{document: any; documentUrl: string}>;
    expand(doc: any, callback: (error: any, data: any) => void): void;
    compact(doc: any, context: any, callback: (error: any, data: any) => void): void;
    frame(doc: any, frame: any, callback: (error: any, data: any) => void): void;
    frame(doc: any, frame: any): Promise<any>;

    toRDF(doc: any, options: any, callback: (error: any, data: any) => void): void;
    toRDF(doc: any, options: any): Promise<any>;
    fromRDF(src: any, options: any, callback: (error: any, data: any) => void): void;
    fromRDF(src: any, options: any): Promise<any>;

    registerRDFParser(
      contentType: string,
      calback: (input: any, callback: (error: Error | undefined, result: Quad[]) => void) => any
    ): void;
  }

  interface SimpleTerm {
    termType: 'NamedNode';
    value: string;
  }

  interface Literal {
    termType: 'Literal';
    language: string;
    value: string;
    datatype: SimpleTerm;
  }

  interface BlankTerm {
    termType: 'BlankNode';
    value: string;
  }

  interface GraphTerm {
    termType: 'DefaultGraph';
    value: string;
  }

  type Term = SimpleTerm | Literal | BlankTerm;

  interface Quad {
    subject: Term;
    predicate: Term;
    object: Term;
    graph: GraphTerm;
  }
}

declare module "jsonld" {
  var jsonld: JsonLd.JsonLdStatic;
  export = jsonld;
}
