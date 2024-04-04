import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ITranslator } from '@jupyterlab/translation';
import { IRunningSessionManagers } from '@jupyterlab/running';
import { Signal } from '@lumino/signaling';
import { showKernelSpecDialog } from './kernelspec'; // Import the function
import { getKernelIconUrl } from './kernelspec'; // Import the function
import { FileEditor } from '@jupyterlab/fileeditor';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import { CommandRegistry } from '@lumino/commands';

import {
  consoleIcon,
  notebookIcon,
  fileIcon,
  infoIcon
} from '@jupyterlab/ui-components';
import { EditorLanguageRegistry } from '@jupyterlab/codemirror';
import { Menu } from '@lumino/widgets';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { WidgetTracker } from '@jupyterlab/apputils';
const ITEM_CLASS = 'jp-mod-av-kernel';
const tracker = new WidgetTracker<IDocumentWidget<FileEditor>>({
  namespace: 'editor'
});

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
function getCreateConsoleFunction(
  commands: CommandRegistry,
  key: string
): (
  widget: IDocumentWidget<FileEditor>,
  args?: ReadonlyPartialJSONObject
) => Promise<void> {
  return async function createConsole(
    widget: IDocumentWidget<FileEditor>,
    args?: ReadonlyPartialJSONObject
  ): Promise<void> {
    const options = args || {};
    const console = await commands.execute('console:create', {
      activate: options['activate'],
      name: widget.context.contentsModel?.name,
      path: widget.context.path,
      kernelPreference: { name: key },
      ref: widget.id,
      insertMode: 'split-bottom'
    });

    widget.context.pathChanged.connect((sender, value) => {
      console.session.setPath(value);
      console.session.setName(widget.context.contentsModel?.name);
    });
  };
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
            app.commands.execute('docmanager:open', {
              path: model.path
            });
            const widget = tracker.currentWidget;
            console.log(tracker);
            if (!widget) {
              return;
            }

            return getCreateConsoleFunction(commands, key)(widget, args);
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
