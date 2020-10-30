declare module 'bio-pv' {
  function Viewer(domElement: Element, props: any);
  interface Viewer {
    fitParent(): void;
    centerOn(structure: Structure): void;
    clear(): void;
    ballsAndSticks(s: string, value: any): void;
    cartoon(s: string, structure: Structure, params?: CartoonParams): void;
    tube(s: string, structure: Structure): void;
    lines(s: string, structure: Structure): void;
    lineTrace(s: string, structure: Structure): void;
    sline(s: string, structure: Structure): void;
    trace(s: string, structure: Structure): void;
  }

  interface CartoonParams {
    color?: any;
  }

  interface Structure {
    select(params: any): any;
  }

  namespace io {
    function pdb(str: string): Structure;
  }

  namespace color {
    function ssSuccession(): any;
  }
}
