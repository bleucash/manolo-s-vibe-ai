# ui

## Overview

Design-system primitives. Almost every file is a shadcn/ui wrapper over Radix UI
or another headless library, styled with Tailwind via `cn` from `@/lib/utils`
and, where variants exist, `class-variance-authority`. Two files are
project-specific: `LoadingState.tsx` (the app's loading screen) and
`use-toast.ts` (a re-export shim). Nothing here talks to Supabase or the network.
Feature components in `src/components` and `src/pages` build on these.

## Interface

Custom (not shadcn):

- `[LoadingState.tsx:LoadingState]` named and default export, props
  `{ fullPage?: boolean }` (default `false`). Renders a lucide `Loader2` and
  the fixed text "Neural Engine Initializing...".
- `[use-toast.ts:useToast, toast]` re-exported from `@/hooks/use-toast`.

Two toast systems exist side by side, with colliding names:

- `[sonner.tsx:Toaster, toast]` wraps `sonner`, with the theme from `next-themes`.
- `[toaster.tsx:Toaster]` renders the Radix toast stack from `useToast`, using
  `[toast.tsx:ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction, ToastProps, ToastActionElement]`
  (`@radix-ui/react-toast`; internal `toastVariants`: `default | destructive`).

Variant helpers and props that are exported:

- `[button.tsx:Button, buttonVariants, ButtonProps]` `variant`:
  `default | destructive | outline | secondary | ghost | link`; `size`:
  `default | sm | lg | icon`; `asChild` swaps `<button>` for Radix `Slot`.
- `[badge.tsx:Badge, badgeVariants, BadgeProps]` `variant`:
  `default | secondary | destructive | outline`.
- `[toggle.tsx:Toggle, toggleVariants]` `variant`: `default | outline`; `size`:
  `default | sm | lg`. `[toggle-group.tsx:ToggleGroup, ToggleGroupItem]` reuses `toggleVariants`.
- `[navigation-menu.tsx:navigationMenuTriggerStyle]` base class only, no variant keys.

Primitive wrappers (file: exports, underlying library):

- `[accordion.tsx:Accordion, AccordionItem, AccordionTrigger, AccordionContent]` `@radix-ui/react-accordion`
- `[alert-dialog.tsx:AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel]` `@radix-ui/react-alert-dialog`
- `[alert.tsx:Alert, AlertTitle, AlertDescription]` plain HTML plus cva (`default | destructive`)
- `[aspect-ratio.tsx:AspectRatio]` `@radix-ui/react-aspect-ratio`
- `[avatar.tsx:Avatar, AvatarImage, AvatarFallback]` `@radix-ui/react-avatar`
- `[breadcrumb.tsx:Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis]` plain HTML plus `@radix-ui/react-slot`
- `[calendar.tsx:Calendar, CalendarProps]` `react-day-picker`
- `[card.tsx:Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent]` plain HTML
- `[carousel.tsx:CarouselApi, Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext]` `embla-carousel-react`
- `[chart.tsx:ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle, ChartConfig]` `recharts`
- `[checkbox.tsx:Checkbox]` `@radix-ui/react-checkbox`
- `[collapsible.tsx:Collapsible, CollapsibleTrigger, CollapsibleContent]` `@radix-ui/react-collapsible`
- `[command.tsx:Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator]` `cmdk`
- `[context-menu.tsx:ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuPortal, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuRadioGroup]` `@radix-ui/react-context-menu`
- `[dialog.tsx:Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription]` `@radix-ui/react-dialog`
- `[drawer.tsx:Drawer, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription]` `vaul`
- `[dropdown-menu.tsx:DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup]` `@radix-ui/react-dropdown-menu`
- `[form.tsx:useFormField, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, FormField]` `react-hook-form`
- `[hover-card.tsx:HoverCard, HoverCardTrigger, HoverCardContent]` `@radix-ui/react-hover-card`
- `[input-otp.tsx:InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator]` `input-otp`
- `[input.tsx:Input]`, `[textarea.tsx:Textarea, TextareaProps]`, `[table.tsx:Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption]`, `[skeleton.tsx:Skeleton]` plain HTML
- `[label.tsx:Label]` `@radix-ui/react-label`
- `[menubar.tsx:Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarLabel, MenubarCheckboxItem, MenubarRadioGroup, MenubarRadioItem, MenubarPortal, MenubarSubContent, MenubarSubTrigger, MenubarGroup, MenubarSub, MenubarShortcut]` `@radix-ui/react-menubar`
- `[navigation-menu.tsx:NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuViewport]` `@radix-ui/react-navigation-menu`
- `[pagination.tsx:Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious]` plain HTML plus `buttonVariants`
- `[popover.tsx:Popover, PopoverTrigger, PopoverContent]` `@radix-ui/react-popover`
- `[progress.tsx:Progress]` `@radix-ui/react-progress`
- `[radio-group.tsx:RadioGroup, RadioGroupItem]` `@radix-ui/react-radio-group`
- `[resizable.tsx:ResizablePanelGroup, ResizablePanel, ResizableHandle]` `react-resizable-panels`
- `[scroll-area.tsx:ScrollArea, ScrollBar]` `@radix-ui/react-scroll-area`
- `[select.tsx:Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton]` `@radix-ui/react-select`
- `[separator.tsx:Separator]` `@radix-ui/react-separator`
- `[sheet.tsx:Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetOverlay, SheetPortal, SheetTitle, SheetTrigger]` `@radix-ui/react-dialog` (internal `sheetVariants` side: `top | bottom | left | right`, default `right`)
- `[sidebar.tsx:Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar]` composed from local `sheet`, `tooltip`, `button`, `input`, `separator`, `skeleton`
- `[slider.tsx:Slider]` `@radix-ui/react-slider`
- `[switch.tsx:Switch]` `@radix-ui/react-switch`
- `[tabs.tsx:Tabs, TabsList, TabsTrigger, TabsContent]` `@radix-ui/react-tabs`
- `[tooltip.tsx:Tooltip, TooltipTrigger, TooltipContent, TooltipProvider]` `@radix-ui/react-tooltip`
- Subdirectories: None.

## Invariants

- Provider-scoped hooks throw outside their provider:
  `[carousel.tsx:useCarousel]` "useCarousel must be used within a <Carousel />";
  `[chart.tsx:useChart]` "useChart must be used within a <ChartContainer />";
  `[sidebar.tsx:useSidebar]` "useSidebar must be used within a SidebarProvider.".
  Render the matching sub-components inside their root.
- `[form.tsx:useFormField]` needs a surrounding `<Form>` (react-hook-form
  `FormProvider`). Its `if (!fieldContext)` throw cannot fire, because
  `FormFieldContext` defaults to `{}`; outside `<FormField>`/`<FormItem>` it
  silently produces ids such as `undefined-form-item`.
- `[sidebar.tsx:SidebarProvider]` `open` is controlled when the `open` prop is
  passed (`open = openProp ?? _open`, changes go to `onOpenChange`), otherwise
  uncontrolled from `defaultOpen` (default `true`). `openMobile` is always
  internal state.
- `[toggle-group.tsx:ToggleGroupItem]` The group's `variant`/`size` override the
  item's own props.
- `[chart.tsx:ChartConfig]` Each entry takes `color` or `theme`, not both.
  `[chart.tsx:ChartTooltipContent]` guards the styled value with
  `item.value && (...)`, so a value of `0` renders as a bare, unstyled "0"
  text node instead of the styled span. When a `formatter` is passed, that
  branch renders `formatter(...)` and the guard does not apply.
- `[input-otp.tsx:InputOTPSlot]` `index` is required and is read from
  `OTPInputContext.slots[index]` without a guard.

## Side Effects

- `[sidebar.tsx:SidebarProvider]` Writes
  `document.cookie = "sidebar:state=<open>; path=/; max-age=604800"` on every
  `setOpen`. Nothing in this file reads it back.
- `[sidebar.tsx:SidebarProvider]` Adds a `window` `keydown` listener: Ctrl/Cmd+`b`
  calls `preventDefault()` and toggles the sidebar. Removed on cleanup.
- `[sidebar.tsx:SidebarProvider]` Calls `useIsMobile()` from
  `@/hooks/use-mobile`, which adds a `window.matchMedia` `change` listener
  and removes it on cleanup.
- `[chart.tsx:ChartStyle]` Injects a `<style>` element via
  `dangerouslySetInnerHTML` with `--color-<key>` CSS variables built from
  `ChartConfig`.
- `[carousel.tsx:Carousel]` Subscribes to embla `reInit` and `select`. Cleanup
  removes only `select`, so the `reInit` listener is never removed.
- `[sonner.tsx:Toaster]` Reads the theme via `next-themes` `useTheme()`
  (falls back to `"system"`).
- `[toaster.tsx:Toaster]` Subscribes to toast state through `@/hooks/use-toast`.
  Its timers live in that hook, not in this directory.
- No Supabase, fetch, storage or navigation calls.

## Verification

- Run: `npm run typecheck` (`tsc --build`) and `npm run build` (`vite build`).
  `package.json` has no `test` script.
