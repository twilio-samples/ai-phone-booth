// Validation for POST /api/admin/config, extracted out of frontend.ts so it
// can be unit tested without a running Fastify instance or Twilio client.

import { validateMenuItems } from "./menu.ts";
import type { BoothConfig } from "./sync.ts";

export const DRINK_TYPES = ["coffee", "smoothie", "drinks"] as const;

export interface AdminConfigValidationResult {
  errors: Record<string, string>;
  config: BoothConfig | null;
}

export function validateAdminConfig(body: Record<string, unknown>): AdminConfigValidationResult {
  const errors: Record<string, string> = {};

  if (typeof body.attractMode !== "boolean") errors.attractMode = "Must be true or false.";
  if (typeof body.allowPhoneNumberOverride !== "boolean") errors.allowPhoneNumberOverride = "Must be true or false.";

  const drinkType = String(body.drinkType ?? "").trim().toLowerCase();
  if (!DRINK_TYPES.includes(drinkType as typeof DRINK_TYPES[number])) {
    errors.drinkType = 'Must be "coffee", "smoothie", or "drinks".';
  }

  const eventName = String(body.eventName ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(eventName)) {
    errors.eventName = "Must be lowercase letters, numbers, and hyphens only (e.g. wearedevs).";
  }

  const eventDisplayName = String(body.eventDisplayName ?? "").trim();
  if (eventDisplayName.length > 80) errors.eventDisplayName = "Must be 80 characters or fewer.";
  else if (/[<>]/.test(eventDisplayName)) errors.eventDisplayName = "Cannot contain < or > characters.";

  const menuItems = String(body.menuItems ?? "").trim();
  const menuError = validateMenuItems(menuItems);
  if (menuError) errors.menuItems = menuError;

  if (Object.keys(errors).length > 0) {
    return { errors, config: null };
  }

  return {
    errors: {},
    config: {
      attractMode: body.attractMode as boolean,
      allowPhoneNumberOverride: body.allowPhoneNumberOverride as boolean,
      drinkType,
      eventName,
      eventDisplayName,
      menuItems,
    },
  };
}
