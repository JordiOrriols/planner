export function buildShareLink(route: string): string {
  const sanitizedRoute = route.replace(/^#?\/?/, "");
  const base = `${window.location.origin}${window.location.pathname}`.replace(/#.*$/, "");
  return `${base}#/${sanitizedRoute}`;
}

export async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
