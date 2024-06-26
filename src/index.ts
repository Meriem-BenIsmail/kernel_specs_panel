import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ITranslator } from '@jupyterlab/translation';
import { IRunningSessionManagers } from '@jupyterlab/running';
import { Signal } from '@lumino/signaling';
import { showKernelSpecDialog } from './kernelspec';
import { getKernelIconUrl } from './kernelspec';
import {
  consoleIcon,
  notebookIcon,
  fileIcon,
  infoIcon
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
          const iconUrl = getKernelIconUrl(kernelspecs[key]);

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
  /* command to start a console */
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
  /* command to start a notebook */
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
  /* command to dispaly the kernel specs */
  commands.addCommand('display-kernelspec', {
    icon: infoIcon,
    label: trans.__('Display Kernel Specs'),
    execute: async args => {
      const node = app.contextMenuHitTest(test);
      const id = (args.id as string) ?? node?.dataset['context'];
      const kernelSpec = kernelspecs[id];

      if (kernelSpec) {
        showKernelSpecDialog(kernelSpec);
      }
    }
  });

  /* commands to start different files depending on the extension chosen and opens a console*/
  Object.entries(kernelspecs).forEach(([key, value]: [string, any]) => {
    const submenu = new Menu({ commands });
    submenu.title.label = `${value.display_name} Files`;
    submenu.title.icon = fileIcon;

    const language = value.language;
    const defaultLanguages = EditorLanguageRegistry.getDefaultLanguages();
    const fileExtensions =
      defaultLanguages.find(
        item => item.name.toLowerCase() === language.toLowerCase()
      )?.extensions ?? [];
    fileExtensions.forEach(extension => {
      const openFileCommand = `open-new-file-${key}-${extension}`;
      commands.addCommand(openFileCommand, {
        label: `${extension} File`,
        icon: fileIcon,
        execute: async args => {
          try {
            const model = await serviceManager.contents.newUntitled({
              type: 'file',
              path: '.',
              ext: extension,
              language: language
            });
            await app.commands.execute('docmanager:open', {
              path: model.path
            });
            await app.commands.execute('console:create', {
              name: model.name,
              path: model.path,
              kernelPreference: { name: key },
              insertMode: 'split-bottom'
            });
          } catch (error) {
            console.error('Error creating untitled file:', error);
          }
        }
      });
      submenu.addItem({ command: openFileCommand });
    });

    contextMenu.addItem({
      type: 'submenu',
      submenu,
      selector: `.jp-mod-av-kernel[data-context="${key}"]`,
      rank: 2
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
    command: 'display-kernelspec',
    selector: '.jp-mod-av-kernel',
    rank: 3
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
