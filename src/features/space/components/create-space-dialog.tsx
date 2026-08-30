/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChangeEvent, FormEvent } from "react";
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
import { Textarea as TextareaPrimitive } from "@/components/aicanvas/andromeda/components/Textarea";
import { SpaceIconPicker } from "@/features/resource/space-icon-picker";
import type { SpaceForm } from "../types";
const Button: any = ButtonPrimitive;
const Input: any = InputPrimitive;
const Textarea: any = TextareaPrimitive;
export function CreateSpaceDialog({
  open,
  form,
  mode = "create",
  contextLabel,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  form: SpaceForm;
  mode?: "create" | "edit";
  contextLabel?: string;
  onFormChange: (form: SpaceForm) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const editing = mode === "edit";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>{editing ? "Edit space" : "Create space"}</DialogTitle>
            <DialogDescription>
              {contextLabel
                ? `In ${contextLabel}.`
                : "Spaces organize resources inside a vault."}
            </DialogDescription>
          </div>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody>
            <div className="flex flex-col gap-[var(--andromeda-2)]">
              <span className="[font-family:var(--andromeda-font-mono)] text-[length:var(--andromeda-text-xs)] font-[number:var(--andromeda-weight-medium)] uppercase [letter-spacing:var(--andromeda-tracking-wider)] text-[color:var(--andromeda-text-secondary)]">
                Icon
              </span>
              <SpaceIconPicker
                disabled={false}
                onSelect={(icon) => onFormChange({ ...form, icon })}
                triggerClassName="size-10 border border-border bg-background text-primary hover:bg-muted [&_svg]:size-5"
                value={form.icon}
              />
            </div>
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
          </DialogBody>
          <DialogFooter>
            <Button disabled={!form.name.trim()} type="submit">
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
