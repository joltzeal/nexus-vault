/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/aicanvas/andromeda/components/Dialog";
import { Input as InputPrimitive } from "@/components/aicanvas/andromeda/components/Input";
import { Select as SelectPrimitive } from "@/components/aicanvas/andromeda/components/Select";
import { Textarea as TextareaPrimitive } from "@/components/aicanvas/andromeda/components/Textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmojiPicker } from "frimousse";
import type { VaultForm } from "../types";

const Button: any = ButtonPrimitive;
const Input: any = InputPrimitive;
const Select: any = SelectPrimitive;
const Textarea: any = TextareaPrimitive;

export function CreateVaultDialog({
  open,
  form,
  mode = "create",
  isSubmitting = false,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  form: VaultForm;
  mode?: "create" | "edit";
  isSubmitting?: boolean;
  onFormChange: (form: VaultForm) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const editing = mode === "edit";
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>{editing ? "Edit vault" : "Create vault"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this vault's basic information."
                : "Vaults organize your spaces and resources."}
            </DialogDescription>
          </div>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody>
            <Input
              label="Name"
              value={form.name}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onFormChange({ ...form, name: event.target.value })
              }
            />
            <Textarea
              label="Description"
              rows={3}
              value={form.description}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                onFormChange({ ...form, description: event.target.value })
              }
            />
            <div className="flex flex-col gap-[var(--andromeda-2)]">
              <span className="[font-family:var(--andromeda-font-mono)] text-[length:var(--andromeda-text-xs)] font-[number:var(--andromeda-weight-medium)] uppercase [letter-spacing:var(--andromeda-tracking-wider)] text-[color:var(--andromeda-text-secondary)]">
                Cover
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Popover open={coverPickerOpen} onOpenChange={setCoverPickerOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        aria-label="Choose vault cover emoji"
                        type="button"
                        variant="outline"
                      >
                        <span aria-hidden="true" className="text-base leading-none">
                          {form.cover || "◌"}
                        </span>
                        {form.cover ? "Change emoji" : "Choose emoji"}
                      </Button>
                    }
                  />
                  <PopoverContent
                    align="start"
                    className="h-[min(368px,calc(100dvh-2rem))] w-[296px] gap-0 overflow-hidden rounded-lg border border-[color:var(--andromeda-border-base)] bg-[color:var(--andromeda-surface-raised)] p-0 text-[color:var(--andromeda-text-primary)]"
                    positionerClassName="z-[1001]"
                  >
                    <EmojiPicker.Root
                      className="isolate flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[inherit] bg-[color:var(--andromeda-surface-raised)]"
                      onEmojiSelect={(emoji) => {
                        onFormChange({ ...form, cover: emoji.emoji });
                        setCoverPickerOpen(false);
                      }}
                    >
                      <EmojiPicker.Search className="z-10 mx-2 mb-2 mt-2 appearance-none rounded-md border border-[color:var(--andromeda-border-base)] bg-[color:var(--andromeda-surface-hover)] px-2.5 py-2 text-sm text-[color:var(--andromeda-text-primary)] outline-none placeholder:text-[color:var(--andromeda-text-muted)] focus:border-[color:var(--andromeda-accent-400)]" />
                      <ScrollArea className="min-h-0 flex-1 border-t border-[color:var(--andromeda-border-base)]">
                        <EmojiPicker.Viewport className="relative h-full min-h-0 outline-hidden">
                          <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-[color:var(--andromeda-text-muted)]">
                            Loading...
                          </EmojiPicker.Loading>
                          <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-[color:var(--andromeda-text-muted)]">
                            No emoji found.
                          </EmojiPicker.Empty>
                          <EmojiPicker.List
                            className="select-none pb-1.5"
                            components={{
                              CategoryHeader: ({ category, ...props }) => (
                                <div
                                  className="bg-[color:var(--andromeda-surface-raised)] px-3 pb-1.5 pt-3 font-medium text-xs text-[color:var(--andromeda-text-secondary)]"
                                  {...props}
                                >
                                  {category.label}
                                </div>
                              ),
                              Row: ({ children, ...props }) => (
                                <div className="scroll-my-1.5 px-1.5" {...props}>
                                  {children}
                                </div>
                              ),
                              Emoji: ({ emoji, ...props }) => (
                                <button
                                  className="flex size-8 items-center justify-center rounded-md text-lg data-[active]:bg-[color:var(--andromeda-surface-hover)]"
                                  {...props}
                                >
                                  {emoji.emoji}
                                </button>
                              ),
                            }}
                          />
                        </EmojiPicker.Viewport>
                      </ScrollArea>
                    </EmojiPicker.Root>
                  </PopoverContent>
                </Popover>
                {form.cover ? (
                  <Button
                    onClick={() => onFormChange({ ...form, cover: "" })}
                    type="button"
                    variant="ghost"
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
            <Select
              label="Visibility"
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                onFormChange({
                  ...form,
                  visibility: event.target.value as VaultForm["visibility"],
                })
              }
              value={form.visibility}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
              <option value="password">Password</option>
            </Select>
          </DialogBody>
          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting || !form.name.trim()} type="submit">
              {isSubmitting ? "Saving..." : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
