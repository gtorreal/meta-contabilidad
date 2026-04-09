/** null/undefined = usar catálogo según régimen; número = debe coincidir con normal o acelerada. */
export function usefulLifeErrorForCategory(
  category: { normalLifeMonths: number; acceleratedLifeMonths: number },
  usefulLifeMonths: number | null | undefined,
): string | null {
  if (usefulLifeMonths == null) return null;
  const ok =
    usefulLifeMonths === category.normalLifeMonths ||
    usefulLifeMonths === category.acceleratedLifeMonths;
  if (ok) return null;
  return "La vida útil debe ser la normal o la acelerada de la categoría elegida.";
}
