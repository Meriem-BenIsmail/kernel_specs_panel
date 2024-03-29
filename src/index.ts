import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ITranslator } from '@jupyterlab/translation';
import { IRunningSessionManagers } from '@jupyterlab/running';
import { Signal } from '@lumino/signaling';

const ITEM_CLASS = 'jp-mod-kernel';

class CustomPanelSignaler {
  constructor() {
    this._runningChanged = new Signal<this, void>(this);
  }

  get runningChanged(): Signal<this, void> {
    return this._runningChanged;
  }

  emitRunningChanged(): void {
    this._runningChanged.emit(void 0);
  }

  private _runningChanged: Signal<this, void>;
}

export async function addCustomRunningPanel(
  managers: IRunningSessionManagers,
  translator: ITranslator,
  app: JupyterFrontEnd,
  serviceManager: any
): Promise<void> {
  const trans = translator.load('jupyterlab');
  const { contextMenu } = app;
  const kernelspecs = serviceManager.kernelspecs.specs.kernelspecs;
  const signaler = new CustomPanelSignaler();
  managers.add({
    name: trans.__('Available Kernels'),
    running: () => {
      const availableKernels = Object.entries(kernelspecs).map(
        ([key, value]: [string, any]) => {
          const iconUrl = value.resources ? value.resources['logo-32x32'] : '';
          return {
            label: () => value.display_name,
            widget: null,
            icon: () => iconUrl,
            context: key,
            className: ITEM_CLASS
          };
        }
      );
      return availableKernels;
    },

    refreshRunning: () => {},
    runningChanged: signaler.runningChanged,
    shutdownAll: () => {}
  });

  const test = (node: HTMLElement) => node.classList.contains(ITEM_CLASS);

  contextMenu.opened.connect(() => {
    const node = app.contextMenuHitTest(test);
    console.log(node);
    const id = node?.dataset['context'];
    if (!id) {
      return;
    }
    console.log(id);
  });

  signaler.emitRunningChanged();
}

const extension: JupyterFrontEndPlugin<void> = {
  id: 'custom-running-panel',
  autoStart: true,
  requires: [IRunningSessionManagers, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    managers: IRunningSessionManagers,
    translator: ITranslator
  ) => {
    const { serviceManager } = app;
    return addCustomRunningPanel(managers, translator, app, serviceManager);
  }
};

export default extension;
