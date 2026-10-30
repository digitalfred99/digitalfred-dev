export function downloadDocument(html: string, filename: string) {
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `${filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-") || "document"}.html`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export function printDocument(frame: HTMLIFrameElement | null) {
  if (!frame?.contentWindow) throw new Error("The document preview is not ready to print.");
  frame.contentWindow.focus();
  frame.contentWindow.print();
}
