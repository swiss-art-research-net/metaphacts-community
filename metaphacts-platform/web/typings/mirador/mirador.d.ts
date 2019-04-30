import * as OpenSeadragon from 'openseadragon';

declare global {
  namespace Mirador {
    var OpenSeadragon: (options: OpenSeadragon.ViewerOptions) => OpenSeadragon.Viewer;

    interface Instance {
      eventEmitter: EventEmitter;
      saveController: SaveController;
      viewer: Viewer;
    }

    class EventEmitter {
      static debug: boolean;
      emitterId: number;
      debug: boolean;
      subscribe(event: string, handler: Function): void;
      unsubscribe(event: string): void;
      publish(event: string, ...args: any[]): void;
    }

    class SaveController {}

    class AnnotationTooltip {
      viewerTemplate: any;
    }

    interface Options {
      id: string;

      workspaceType?: string;
      workspaces?: any;
      layout?: string | LayoutDescription;
      saveSession?: boolean;

      manifests?: any[];
      data?: Array<{
        manifestUri: string;
        location: string;
        manifestContent?: any;
      }>;

      openManifestsPage?: boolean;
      preserveManifestOrder?: boolean;

      windowSettings?: WindowSettings;
      windowObjects?: WindowObject[];

      autoHideControls?: boolean;
      fadeDuration?: number;
      timeoutDuration?: number;

      availableAnnotationModes?: any[];
      availableAnnotationDrawingTools?: AnnotationDrawingTool[];
      availableAnnotationStylePickers?: AnnotationStylePicker[];

      drawingToolsSettings?: any;
      availableExternalCommentsPanel?: boolean;
      shapeHandleSize?: number;

      availableCanvasTools?: any[];

      mainMenuSettings?: {
        show: boolean;
        buttons?: {
          bookmark?: boolean;
          layout?: boolean;
          options?: boolean;
          fullScreenViewer?: boolean;
        };
      };

      workspacePanelSettings?: {
        maxRows?: number;
        maxColumns?: number;
        preserveWindows?: boolean;
      };

      showAddFromURLBox?: boolean;

      buildPath?: string;
      i18nPath?: string;
      imagesPath?: string;

      annotationEndpoint?: {
        name: string;
        module: string;
        options: any;
      };
      annotationBodyEditor?: {
        module: string;
        options: any;
      };
      jsonStorageEndpoint?: {
        name: string;
        module: string;
        options: any;
      };
      sharingEndpoint?: any;
      lockController?: any;
    }

    interface WindowSettings {
      availableViews?: WindowView[];
      viewType?: WindowView;
      bottomPanel?: boolean;
      bottomPanelVisible?: true;
      sidePanel?: boolean;
      sidePanelOptions?: {
        toc?: boolean;
        annotations?: boolean;
      };
      sidePanelVisible?: boolean;
      overlay?: boolean;
      canvasControls?: {
        annotations?: {
          annotationLayer?: boolean;
          annotationCreation?: boolean;
          annotationState?: 'on' | 'off';
          annotationRefresh?: boolean;
        };
        imageManipulation?: {
          manipulationLayer?: boolean;
          controls?: {
            rotate?: boolean;
            brightness?: boolean;
            contrast?: boolean;
            saturate?: boolean;
            grayscale?: boolean;
            invert?: boolean;
          };
        };
      }
      fullScreen?: boolean;
      displayLayout?: boolean;
      layoutOptions?: {
        newObject?: boolean;
        close?: boolean;
        slotRight?: boolean;
        slotLeft?: boolean;
        slotAbove?: boolean;
        slotBelow?: boolean;
      }
    }

    type WindowView = 'ThumbnailsView' | 'ImageView' | 'ScrollView' | 'BookView';

    interface WindowObject extends WindowSettings {
      id?: string;
      loadedManifest?: string;
      canvasID?: boolean;
      windowOptions?: any;
    }

    interface LayoutDescription {
      type: 'row' | 'column';
      children?: LayoutDescription[];
    }

    type AnnotationDrawingTool = 'Rectangle' | 'Ellipse' | 'Freehand' | 'Polygon' | 'Pin';
    type AnnotationStylePicker = 'StrokeColor' | 'FillColor' | 'StrokeType';

    /* implementation details */
    interface Viewer {
      workspace: Workspace;
    }

    /* implementation details */
    interface Workspace {
      windows: Window[];
      calculateLayout(): void;
    }

    /* implementation details */
    interface Window {
      id: string;
      eventEmitter: EventEmitter;
      focusModules: {
        ImageView: ImageViewModule;
      };
      canvasID: string;
    }

    /* implementation details */
    interface ImageViewModule {
      // hud: ImageViewHud;
      osd: OpenSeadragon.Viewer;
      annotationsLayer: AnnotationsLayer;
    }

    /* implementation details */
    interface AnnotationsLayer {
      drawTool: OsdRegionDrawTool;
    }

    /* implementation details */
    interface OsdRegionDrawTool {
      svgOverlay: Overlay;
    }

    /* implementation details */
    class Overlay {
      init(): void;
      hitOptions: {
        tolerance: number;
      };
    }

    /* implementation details */
    class MiradorDualStrategy {
      /** @returns OAnnotation */
      buildAnnotation(options: any): any;
    }
  }

  function Mirador(options: Mirador.Options): Mirador.Instance;
}
