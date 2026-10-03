export function downloadRadarImage(svgEl: SVGSVGElement, size: number) {
  const margin = 40;
  const newSize = size + margin * 2;

  const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute("width", newSize.toString());
  svgClone.setAttribute("height", newSize.toString());
  svgClone.setAttribute("viewBox", `0 0 ${newSize} ${newSize}`);

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${margin}, ${margin})`);
  while (svgClone.firstChild) {
    g.appendChild(svgClone.firstChild);
  }
  svgClone.appendChild(g);

  const paths = svgClone.querySelectorAll("path, line");
  paths.forEach((element) => {
    const strokeWidth = element.getAttribute("strokeWidth");
    if (strokeWidth) {
      const currentWidth = parseFloat(strokeWidth);
      element.setAttribute("strokeWidth", (currentWidth * 0.75).toString());
    }
  });

  const textElements = svgClone.querySelectorAll("text");
  textElements.forEach((text) => {
    const currentClass = text.getAttribute("class") || "";
    if (currentClass.includes("fill-slate-500")) {
      text.setAttribute("fill", "#64748b");
    } else if (currentClass.includes("fill-slate-400")) {
      text.setAttribute("fill", "#94a3b8");
    }
    text.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
    if (currentClass.includes("text-xs")) text.setAttribute("font-size", "10");
    else if (currentClass.includes("text-[10px]")) text.setAttribute("font-size", "8");
    else if (currentClass.includes("text-[9px]")) text.setAttribute("font-size", "7");
    else if (currentClass.includes("text-[7px]")) text.setAttribute("font-size", "6");
    if (currentClass.includes("font-semibold")) text.setAttribute("font-weight", "600");
    text.removeAttribute("class");
  });

  const svgData = new XMLSerializer().serializeToString(svgClone);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const scale = 2.5;
  const scaledSize = newSize * scale;
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    canvas.width = scaledSize;
    canvas.height = scaledSize;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, scaledSize, scaledSize);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const link = document.createElement("a");
          link.download = `radar-chart-${Date.now()}.png`;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }
      },
      "image/png",
      0.95
    );
  };

  img.src = url;
}
