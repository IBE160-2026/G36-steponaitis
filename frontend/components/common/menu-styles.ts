// Shared dropdown menu styles (radix DropdownMenu): the plan plate menu and the saved-plans row menu.

const MENU_FADE =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150";

/** `DropdownMenu.Content`: a surface panel with an overlay shadow that fades in and out. */
export const MENU_CONTENT_CLASS = `z-50 min-w-40 rounded-lg border border-border bg-surface p-1 text-ink shadow-overlay ${MENU_FADE}`;

/** A `DropdownMenu.Item` (a link or button), tinted while highlighted. */
export const MENU_ITEM_CLASS =
  "flex h-control-md items-center rounded px-2 type-button outline-none data-[highlighted]:bg-selected-tint";
