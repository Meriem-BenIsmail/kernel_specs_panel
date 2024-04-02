import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ITranslator } from '@jupyterlab/translation';
import { IRunningSessionManagers } from '@jupyterlab/running';
import { Signal } from '@lumino/signaling';
import {
  consoleIcon,
  notebookIcon,
  jupyterIcon
} from '@jupyterlab/ui-components';
import { EditorLanguageRegistry } from '@jupyterlab/codemirror';
import { Menu } from '@lumino/widgets';

const ITEM_CLASS = 'jp-mod-av-kernel';

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
  commands.addCommand('create-new-console', {
    icon: consoleIcon,
    label: trans.__('New Console for Kernel'),
    execute: args => {
      const node = app.contextMenuHitTest(test);
      const id = (args.id as string) ?? node?.dataset['context'];
      if (id) {
        return commands.execute('console:create', {
          kernelPreference: { name: id }
        });
      }
    }
  });
  commands.addCommand('create-new-notebook', {
    icon: notebookIcon,
    label: trans.__('New Notebook for Kernel'),
    execute: async args => {
      const node = app.contextMenuHitTest(test);
      const id = (args.id as string) ?? node?.dataset['context'];
      if (id) {
        const result = await app.commands.execute('docmanager:new-untitled', {
          path: '.',
          type: 'notebook'
        });
        await app.commands.execute('docmanager:open', {
          path: result.path,
          factory: 'Notebook',
          kernel: {
            name: id
          }
        });
      }
    }
  });
  commands.addCommand('create-new-file', {
    execute: async args => {}
  });
  const submenuItems = Object.entries(kernelspecs).map(
    ([key, value]: [string, any]) => {
      const language =
        serviceManager.kernelspecs.specs.kernelspecs[key].language;
      const defaultLanguages = EditorLanguageRegistry.getDefaultLanguages();
      let fileExtensions: string[] | any;

      defaultLanguages.forEach(item => {
        if (item.name.toLocaleLowerCase() === language.toLocaleLowerCase()) {
          fileExtensions = item.extensions;
        }
      });

      return {
        command: 'create-new-file',
        args: { extensions: fileExtensions },
        label: value.display_name
      };
    }
  );
  const submenu = new Menu({ commands });
  submenu.title.label = 'New File for Kernel';
  submenu.title.icon = jupyterIcon;
  submenuItems.forEach(item => {
    submenu.addItem({
      command: item.command,
      args: item.args
    });
  });

  contextMenu.addItem({
    command: 'create-new-console',
    selector: '.jp-mod-av-kernel',
    rank: 0
  });
  contextMenu.addItem({
    command: 'create-new-notebook',
    selector: '.jp-mod-av-kernel',
    rank: 1
  });
  contextMenu.addItem({
    type: 'submenu',
    submenu,
    selector: '.jp-mod-av-kernel',
    rank: 2
  });

  contextMenu.opened.connect(() => {
    const node = app.contextMenuHitTest(test);
    const id = node?.dataset['context'];
    if (!id) {
      return;
    }
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
