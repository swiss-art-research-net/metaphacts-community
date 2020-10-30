declare module 'html-to-react' {
  import * as React from 'react';

  type NodeType = 'text' | 'tag' | 'style' | 'script' | 'comment';

  interface Node {
    name?: string;
    data?: string;
    type: NodeType;
    attribs?: { [key: string]: unknown };
    parent?: Node;
    children?: Node[];
  }

  type ProcessNode<T> = (
    node: Node, children: Array<T>, index?: number
  ) => T | T[];

  interface Instruction<T> {
    shouldProcessNode(node: Node): boolean;
    processNode: ProcessNode<T>;
  }

  interface Options {
    recognizeCDATA?: boolean
  }

  class Parser<T = React.ReactElement<any>> {
    constructor(react: any, options?: Options);
    parse(html: string): T;
    parseWithInstructions(
      html: string, isValidNode: (node: Node) => boolean, instructions: Array<Instruction>
    ): T;
    mapParsedTree(
      domTree: readonly [Node],
      isValidNode: (node: Node) => boolean,
      instructions: Array<Instruction>
    ): T;
  }

  class ProcessNodeDefinitions {
    constructor(react: any)
    processDefaultNode: ProcessNode
  }
}
