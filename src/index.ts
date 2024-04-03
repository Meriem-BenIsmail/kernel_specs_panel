import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ITranslator } from '@jupyterlab/translation';
import { IRunningSessionManagers } from '@jupyterlab/running';
import { Signal } from '@lumino/signaling';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';

import {
  consoleIcon,
  notebookIcon,
  fileIcon,
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
function createKernelSpecDialogContent(kernelSpec: any) {
  const formattedDetails = `
    <div class="kernel-spec-details">
      <div><strong>Name:</strong> ${kernelSpec.name}</div>
      <div><strong>Display Name:</strong> ${kernelSpec.display_name}</div>
      <div><strong>Language:</strong> ${kernelSpec.language}</div>
      <div><strong>Resources:</strong> ${JSON.stringify(kernelSpec.resources)}</div>
      <div><strong>Argv:</strong> ${JSON.stringify(kernelSpec.argv)}</div>
      <div><strong>Metadata:</strong> ${JSON.stringify(kernelSpec.metadata)}</div>
    </div>
  `;
  const content = document.createElement('div');
  content.innerHTML = formattedDetails;
  return content;
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
  const { kernels } = serviceManager;

  const signaler = new CustomPanelSignaler();
  managers.add({
    name: trans.__('Available Kernels'),
    running: () => {
      const availableKernels = Object.entries(kernelspecs).map(
        ([key, value]: [string, any]) => {
          let iconUrl: string;
          if (value.resources) {
            if (value.resources['logo-32x32']) {
              iconUrl = value.resources['logo-32x32'];
            } else if (value.resources['logo-64x64']) {
              iconUrl = value.resources['logo-64x64'];
            } else {
              iconUrl = value.resources['logo-svg'];
            }
          }

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
    shutdownAll: () => kernels.shutdownAll(),
    shutdownLabel: trans.__('Shut Down Kernel'),
    shutdownAllLabel: trans.__('Shut Down All'),
    shutdownAllConfirmationText: trans.__(
      'Are you sure you want to permanently shut down all running kernels?'
    )
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
  commands.addCommand('display-kernelspec', {
    icon: jupyterIcon,
    label: trans.__('Display Kernel Specs'),
    execute: async args => {
      const node = app.contextMenuHitTest(test);
      const id = (args.id as string) ?? node?.dataset['context'];
      const kernelSpec = kernelspecs[id];

      if (kernelSpec) {
        const content = createKernelSpecDialogContent(kernelSpec);
        showDialog({
          title: 'Kernel Specs',
          body: new Widget({ node: content }),
          buttons: [Dialog.okButton()]
        });
      }
    }
  });

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
        execute: async () => {
          try {
            const model = await serviceManager.contents.newUntitled({
              type: 'file',
              path: '.',
              ext: extension,
              language: language
            });

            app.commands.execute('docmanager:open', {
              path: model.path
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
