export function fitObjectBoard(width, height) {
  const fittedWidth = Math.max(0, Math.min(width, height * 16 / 9));
  return { width: fittedWidth, height: fittedWidth * 9 / 16 };
}
