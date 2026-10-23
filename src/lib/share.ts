// Saving post art. On phones we try the native share sheet with files (the user
// picks "Salvar imagem" there); otherwise we download. We never claim to save
// straight into the Photos app — the OS decides.

export interface ShareItem {
  url: string;
  filename: string;
}

export type SaveResult = "shared" | "downloaded" | "zipped" | "cancelled";

const fileCache = new Map<string, Promise<File>>();

function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

async function fetchFile(item: ShareItem): Promise<File> {
  const res = await fetch(item.url);
  if (!res.ok) throw new Error("Não foi possível carregar a imagem.");
  const blob = await res.blob();
  return new File([blob], item.filename, { type: blob.type || "image/jpeg" });
}

function getFile(item: ShareItem) {
  const key = `${item.url}::${item.filename}`;
  let promise = fileCache.get(key);
  if (!promise) {
    promise = fetchFile(item);
    promise.catch(() => fileCache.delete(key));
    fileCache.set(key, promise);
  }
  return promise;
}

/** Warm the cache so the share sheet opens while the tap is still "fresh". */
export function prepareFiles(items: ShareItem[]) {
  if (typeof window === "undefined") return;
  items.forEach((item) => void getFile(item).catch(() => undefined));
}

function triggerDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

export function canShareFiles() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    isTouchDevice()
  );
}

export async function saveImages(items: ShareItem[], opts: { zipName?: string } = {}): Promise<SaveResult> {
  if (items.length === 0) throw new Error("Nenhuma imagem disponível.");
  const files = await Promise.all(items.map(getFile));

  if (canShareFiles() && navigator.canShare({ files })) {
    try {
      await navigator.share({ files });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // NotAllowedError etc. → fall back to download below.
    }
  }

  if (files.length > 1) {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    files.forEach((file) => zip.file(file.name, file));
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, opts.zipName ?? "artes.zip");
    return "zipped";
  }

  triggerDownload(files[0], files[0].name);
  return "downloaded";
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function mediaFilename(title: string, index: number, total: number) {
  const base = slugify(title) || "arte";
  return total > 1 ? `${base}-${index + 1}.jpg` : `${base}.jpg`;
}

export function saveResultMessage(result: SaveResult, count: number) {
  switch (result) {
    case "shared":
      return count > 1 ? "Artes enviadas para o compartilhamento" : "Arte enviada para o compartilhamento";
    case "zipped":
      return `Arquivo .zip com ${count} artes baixado`;
    case "downloaded":
      return "Download da arte iniciado";
    default:
      return null;
  }
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    if (!ok) throw new Error("Não foi possível copiar.");
  }
}
