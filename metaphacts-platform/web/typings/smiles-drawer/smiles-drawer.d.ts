declare module "smiles-drawer" {
  export class Drawer {
    constructor(options: Options);
    draw: (tree: any, id: string, style: 'light' | 'dark', draw?: boolean) => void;
  }

  export interface Options {
    width: number
    height: number
    bondThickness: number
    bondLength: number
    shortBondLength: number
    bondSpacing: number
    atomVisualization: 'default' | 'balls' | 'none'
    fontSizeLarge: number
    fontSizeSmall: number
    padding: number
    terminalCarbons: boolean
    explicitHydrogens: boolean
    overlapSensitivity: number
    overlapResolutionIterations: number
    compactDrawing: boolean
    isometric: boolean
    debug: boolean
    themes: {}
  }

  export function parse(smilesCode: string, onTree: (tree: any) => void, onError: (err: any) => void);
}
