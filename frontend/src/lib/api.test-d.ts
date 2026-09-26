import type { InventoryItem } from "./api";

type Assert<T extends true> = T;

export type InventoryItemHasNoStructuredCurrentLocation = Assert<
  "currentLocation" extends keyof InventoryItem ? false : true
>;