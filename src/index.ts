import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ITranslator } from '@jupyterlab/translation';
import { IRunningSessionManagers } from '@jupyterlab/running';
import { consoleIcon, notebookIcon } from '@jupyterlab/ui-components';
import { Signal } from '@lumino/signaling';

const ITEM_CLASS = 'jp-RunningSessions-item';

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

/**
 * Add the custom running panel section to the running panel.
 *
 * @param managers - The IRunningSessionManagers used to register this section.
 * @param translator - The translator to use.
 * @param app - The JupyterFrontEnd application instance.
 */
export async function addCustomRunningPanel(
  managers: IRunningSessionManagers,
  translator: ITranslator,
  app: JupyterFrontEnd,
  serviceManager: any
): Promise<void> {
  const trans = translator.load('jupyterlab');
  const { commands, contextMenu } = app;
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
            icon: () => iconUrl
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

  const startConsoleCommand = 'running:start-console';
  const startNotebookCommand = 'running:start-notebook';

  commands.addCommand(startConsoleCommand, {
    icon: consoleIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('New Console for Kernel'),
    execute: args => {
      const node = app.contextMenuHitTest(test);

      const id = (args.id as string) ?? node?.dataset['context'];
      if (id) {
        return commands.execute('console:create', { kernelPreference: { id } });
      }
    }
  });

  commands.addCommand(startNotebookCommand, {
    icon: notebookIcon.bindprops({ stylesheet: 'menuItem' }),
    label: trans.__('New Notebook for Kernel'),
    execute: args => {
      const node = app.contextMenuHitTest(test);
      const id = (args.id as string) ?? node?.dataset['context'];
      if (id) {
        return commands.execute('notebook:create-new', { kernelId: id });
      }
    }
  });

  contextMenu.opened.connect(() => {
    const node = app.contextMenuHitTest(test);
    console.log(node);
    const id = node?.dataset['context'];
    console.log('Kernel ID:', id);
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
