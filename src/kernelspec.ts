import { showDialog, Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';

export function showKernelSpecDialog(kernelSpec: any): void {
  const content = createKernelSpecDialogContent(kernelSpec);
  showDialog({
    body: new Widget({ node: content }),
    buttons: [Dialog.okButton()]
  });
}

function createKernelSpecDialogContent(kernelSpec: any): HTMLElement {
  const kernelIconUrl = getKernelIconUrl(kernelSpec);
  const kernelDisplayName = kernelSpec.display_name;
  const kernelHeader = `
      <div class="kernel-header">
        <img src="${kernelIconUrl}" alt="${kernelDisplayName} icon" class="kernel-icon">
        <div class="kernel-display-name">${kernelDisplayName}</div>
      </div>
    `;

  const formattedDetails = `
      <div class="kernel-spec-details">
        ${kernelHeader}
        <div class="details-section"><strong>Name:</strong> ${kernelSpec.name}</div>
        <div class="details-section"><strong>Language:</strong> ${kernelSpec.language}</div>
        <div class="details-section"><strong>Start Kernel With</strong> ${formatArray(kernelSpec.argv)}</div>
        <div class="details-section"><strong>Metadata:</strong> ${Object.keys(kernelSpec.metadata).length === 0 ? 'No metadata for this kernel' : formatObject(kernelSpec.metadata)}</div>
      </div>
    `;

  const content = document.createElement('div');
  content.innerHTML = formattedDetails;
  return content;
}

function getKernelIconUrl(kernelSpec: any): string {
  if (kernelSpec.resources) {
    return (
      kernelSpec.resources['logo-32x32'] ||
      kernelSpec.resources['logo-64x64'] ||
      kernelSpec.resources['logo-svg'] ||
      ''
    );
  }
  return '';
}

function formatObject(obj: any): string {
  if (!obj || typeof obj !== 'object') {
    return '';
  }

  const entries = Object.entries(obj);
  if (entries.length === 0) {
    return '{}';
  }

  const formattedEntries = entries.map(
    ([key, value]) =>
      `<div class="object-entry"><strong>${key}:</strong> ${value}</div>`
  );
  return `<div class="object">${formattedEntries.join('')}</div>`;
}

function formatArray(arr: any[]): string {
  if (!arr || !Array.isArray(arr)) {
    return '';
  }

  if (arr.length === 0) {
    return '[]';
  }

  const formattedItems = arr.map(
    item => `<div class="array-item">${item}</div>`
  );
  return `<div class="array">${formattedItems.join('')}</div>`;
}
