"use client";

import {
  ClockCheck,
  Clock3,
  Download,
  FolderInput,
  Heart,
  MessageSquare,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { type MouseEvent, type ReactNode } from "react";

import { Rating, RatingButton } from "@/components/kibo-ui/rating";
import {
  type OverflowActionItem,
  OverflowActions,
} from "@/components/motion/overflow-actions";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export type ResourceCardActionsProps = {
  disabled?: boolean;
  leadingAction?: ReactNode;
  isChecked?: boolean;
  isReadLater?: boolean;
  isStarred?: boolean;
  onDelete?: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onMove?: () => void;
  onRatingChange?: (rating: number) => void;
  onRetryMetadata?: () => void;
  onToggleChecked?: (checked: boolean) => void;
  onToggleReadLater?: () => void;
  onToggleStar?: () => void;
  rating?: number;
  section?: "all" | "annotation" | "management";
};

export function ResourceCardActions({
  disabled = false,
  leadingAction,
  isChecked = false,
  isReadLater = false,
  isStarred = false,
  onDelete,
  onDownload,
  onEdit,
  onMove,
  onRatingChange,
  onRetryMetadata,
  onToggleChecked,
  onToggleReadLater,
  onToggleStar,
  rating = 0,
  section = "all",
}: ResourceCardActionsProps) {
  const hasOverflowActions = Boolean(
    onToggleChecked ||
    leadingAction ||
    onToggleReadLater ||
    onToggleStar ||
    onRatingChange,
  );
  const hasManagementActions = Boolean(
    onDownload || onEdit || onRetryMetadata || onMove || onDelete,
  );
  const showAnnotationActions = section !== "management";
  const showManagementActions = section !== "annotation";

  if (
    (!showAnnotationActions || (!onToggleChecked && !hasOverflowActions)) &&
    (!showManagementActions || !hasManagementActions)
  )
    return null;

  return (
    <div
      className="flex shrink-0 items-center gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      {showManagementActions && hasManagementActions && (
        <ButtonGroup className="gap-0 overflow-hidden rounded-md border border-border bg-card p-0">
          {onDownload && (
            <ManagementButton
              disabled={disabled}
              label="Download"
              onClick={onDownload}
            >
              <Download />
            </ManagementButton>
          )}
          {onEdit && (
            <ManagementButton disabled={disabled} label="Edit" onClick={onEdit}>
              <Pencil />
            </ManagementButton>
          )}
          {onRetryMetadata && (
            <ManagementButton
              disabled={disabled}
              label="Retry"
              onClick={onRetryMetadata}
            >
              <RefreshCw />
            </ManagementButton>
          )}
          {onDelete && (
            <ManagementButton
              disabled={disabled}
              label="Delete"
              danger
              onClick={onDelete}
            >
              <Trash2 />
            </ManagementButton>
          )}
          {onMove && (
            <ManagementButton disabled={disabled} label="Move" onClick={onMove}>
              <FolderInput />
            </ManagementButton>
          )}
        </ButtonGroup>
      )}

      {showAnnotationActions && hasOverflowActions && (
        <OverflowActions
          primaryActions={[
            ...(onToggleChecked
              ? [
                  {
                    id: "checked",
                    label: "Done",
                    ariaLabel: isChecked ? "Mark as open" : "Mark as done",
                    content: (
                      <Checkbox
                        aria-label={isChecked ? "Mark as open" : "Mark as done"}
                        checked={isChecked}
                        className="size-6 !rounded-sm border-0 bg-secondary text-secondary-foreground hover:bg-muted data-checked:bg-secondary data-checked:text-rose"
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          onToggleChecked(value === true)
                        }
                      />
                    ),
                  } satisfies OverflowActionItem,
                ]
              : []),
            ...(leadingAction
              ? [
                  {
                    id: "file-tree",
                    label: "Tree",
                    ariaLabel: "查看文件树",
                    content: leadingAction,
                  } satisfies OverflowActionItem,
                ]
              : []),
            ...(onToggleReadLater
              ? [
                  {
                    id: "read-later",
                    label: isReadLater ? "Saved" : "Later",
                    icon: isReadLater ? <ClockCheck /> : <Clock3 />,
                    ariaLabel: isReadLater ? "移出稍后查看" : "稍后查看",
                    onClick: onToggleReadLater,
                    disabled,
                    className: isReadLater
                      ? "bg-rose/10 text-rose hover:bg-rose/15"
                      : undefined,
                  } satisfies OverflowActionItem,
                ]
              : []),
            ...(onToggleStar
              ? [
                  {
                    id: "star",
                    label: isStarred ? "Starred" : "Star",
                    icon: (
                      <Star
                        className={isStarred ? "fill-current" : undefined}
                      />
                    ),
                    ariaLabel: isStarred ? "取消收藏资源" : "收藏资源",
                    onClick: onToggleStar,
                    disabled,
                    className: isStarred
                      ? "bg-rose/10 text-rose hover:bg-rose/15"
                      : undefined,
                  } satisfies OverflowActionItem,
                ]
              : []),
          ]}
          overflowActions={
            onRatingChange
              ? [
                  {
                    id: "rating",
                    label: "Rate",
                    ariaLabel: "设置资源评分",
                    content: (
                      <div className="flex h-6 items-center gap-1 px-1">
                        <span>Rate</span>
                        <ResourceCardRating
                          ariaLabel="设置资源评分"
                          onValueChange={onRatingChange}
                          size={14}
                          value={rating}
                        />
                      </div>
                    ),
                  } satisfies OverflowActionItem,
                ]
              : []
          }
          size="sm"
        />
      )}
    </div>
  );
}

export function ResourceCardCommentButton({
  disabled = false,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      disabled={disabled}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick();
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
      <MessageSquare data-icon="inline-start" />
      Comment
    </Button>
  );
}

export function ResourceCardCommentEditor({
  onCancel,
  onChange,
  onSave,
  value,
}: {
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  value: string;
}) {
  return (
    <InputGroup
      className="min-h-20"
      onClick={(event) => event.stopPropagation()}
    >
      <InputGroupTextarea
        autoFocus
        className="mono text-[11px] leading-4"
        onChange={(event) => onChange(event.target.value)}
        placeholder="写下你的判断、提醒或下次要看的重点。"
        value={value}
      />
      <InputGroupAddon align="block-end" className="justify-end">
        <InputGroupButton
          className="mono text-[10px] active:translate-y-0"
          onClick={onCancel}
        >
          取消
        </InputGroupButton>
        <InputGroupButton
          className="mono text-[10px] active:translate-y-0"
          onClick={onSave}
          variant="default"
        >
          保存
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

function ManagementButton({
  children,
  danger = false,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className={cn(
        "!rounded-none border-0 !border-l border-border bg-secondary px-1.5 w-8 text-secondary-foreground transition-colors hover:bg-muted active:bg-accent active:text-primary first:!border-l-0",
        danger && "text-rose hover:text-rose active:text-rose",
      )}
      disabled={disabled}
      onClick={onClick}
      size="icon-xs"
      title={label}
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

function ResourceCardRating({
  ariaLabel,
  onValueChange,
  readOnly = false,
  size,
  value,
}: {
  ariaLabel: string;
  onValueChange?: (value: number) => void;
  readOnly?: boolean;
  size: number;
  value: number;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="flex h-6 items-center justify-center"
      onClick={(event) => event.stopPropagation()}
    >
      <Rating
        onValueChange={(nextValue) =>
          onValueChange?.(nextValue === value ? 0 : nextValue)
        }
        readOnly={readOnly}
        value={value}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <RatingButton icon={<Heart />} key={index} size={size} />
        ))}
      </Rating>
    </div>
  );
}
