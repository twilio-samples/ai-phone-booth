export function heroImageForDrinkType(drinkLabel: string): string {
  if (drinkLabel === "smoothie") return "smoothie.png";
  if (drinkLabel === "drinks") return "barkeeper.png";
  return "barista.png";
}
