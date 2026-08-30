"use client";

import {
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
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { Rating, RatingButton } from "@/components/kibo-ui/rating";
import { Button as AndromedaButton } from "@/components/aicanvas/andromeda/components/Button";
import { Checkbox as AndromedaCheckbox } from "@/components/aicanvas/andromeda/components/Checkbox";
import type { ComponentType } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const Checkbox = AndromedaCheckbox as unknown as ComponentType<
  Record<string, unknown>
>;
const Button = AndromedaButton as unknown as ComponentType<
  Record<string, unknown>
>;
const controlSurfaceClass =
  "border-[color:var(--andromeda-border-base)] bg-[color:var(--andromeda-surface-raised)]";
const actionGroupClass =
  `mono inline-flex h-5 items-center gap-0 border px-0.5 text-label text-[color:var(--andromeda-text-secondary)] ${controlSurfaceClass}`;
const actionButtonClass =
  "size-5 rounded-none border-0 bg-transparent p-0 text-[color:var(--andromeda-text-secondary)] ![backdrop-filter:none] ![-webkit-backdrop-filter:none] ![filter:none] hover:bg-transparent hover:text-[color:var(--andromeda-text-secondary)] [transform:none!important] [&_svg]:size-3 [&_svg]:scale-100 [&_svg]:transition-none";
const flatActionStyle = {
  backdropFilter: "none",
  filter: "none",
  WebkitBackdropFilter: "none",
} as const;

export type ResourceCardActionsProps = {
  comment?: string;
  disabled?: boolean;
  leadingAction?: ReactNode;
  isChecked?: boolean;
  isReadLater?: boolean;
  isStarred?: boolean;
  onClearAnnotation?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onMove?: () => void;
  onRatingChange?: (rating: number) => void;
  onRetryMetadata?: () => void;
  onSaveComment?: (comment: string) => void;
  onToggleChecked?: (checked: boolean) => void;
  onToggleReadLater?: () => void;
  onToggleStar?: () => void;
  rating?: number;
  section?: "all" | "annotation" | "management";
};

export function ResourceCardActions({
  comment = "",
  disabled = false,
  leadingAction,
  isChecked = false,
  isReadLater = false,
  isStarred = false,
  onClearAnnotation,
  onDelete,
  onDownload,
  onEdit,
  onMove,
  onRatingChange,
  onRetryMetadata,
  onSaveComment,
  onToggleChecked,
  onToggleReadLater,
  onToggleStar,
  rating = 0,
  section = "all",
}: ResourceCardActionsProps) {
  const [commentDraft, setCommentDraft] = useState(comment);
  const hasAnnotationAction = Boolean(
    onClearAnnotation || onRatingChange || onSaveComment,
  );
  const hasQuickActions = Boolean(
    leadingAction || hasAnnotationAction || onToggleReadLater || onToggleStar,
  );
  const hasManagementActions = Boolean(
    onDownload || onEdit || onRetryMetadata || onMove || onDelete,
  );
  const showAnnotationActions = section !== "management";
  const showManagementActions = section !== "annotation";

  useEffect(() => {
    // Refresh the draft when the persisted annotation changes externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCommentDraft(comment);
  }, [comment]);

  if (
    (!showAnnotationActions || (!hasQuickActions && !onToggleChecked)) &&
    (!showManagementActions || !hasManagementActions)
  )
    return null;

  return (
    <div
      className="flex shrink-0 items-center gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      {showAnnotationActions && onToggleChecked && (
        <Checkbox
          aria-label={isChecked ? "标记为未处理" : "标记为已处理"}
          checked={isChecked}
          className={cn("!size-5 p-0", controlSurfaceClass)}
          disabled={disabled}
          onCheckedChange={(value: boolean) => onToggleChecked(value)}
          style={flatActionStyle}
        />
      )}

      {showAnnotationActions && hasQuickActions && (
        <div className={actionGroupClass} role="group">
          {leadingAction}
          {rating > 0 && (
            <ResourceCardRating
              ariaLabel={`资源评分 ${rating}/5`}
              readOnly
              size={12}
              value={rating}
            />
          )}
          {hasAnnotationAction && (
            <ResourceAnnotationPopover
              commentDraft={commentDraft}
              disabled={disabled}
              onClear={() => {
                setCommentDraft("");
                onClearAnnotation?.();
              }}
              onCommentDraftChange={setCommentDraft}
              onCommentSave={() => onSaveComment?.(commentDraft)}
              onRatingChange={(value) => onRatingChange?.(value)}
              rating={rating}
            />
          )}
          {onToggleReadLater && (
            <ActionButton
              active={isReadLater}
              disabled={disabled}
              label={isReadLater ? "移出稍后查看" : "稍后查看"}
              onClick={onToggleReadLater}
            >
              <Clock3 />
            </ActionButton>
          )}
          {onToggleStar && (
            <ActionButton
              active={isStarred}
              disabled={disabled}
              label={isStarred ? "取消收藏资源" : "收藏资源"}
              onClick={onToggleStar}
            >
              <Star className={cn(isStarred && "fill-current")} />
            </ActionButton>
          )}
        </div>
      )}

      {showManagementActions && hasManagementActions && (
        <div className={actionGroupClass} role="group">
          {onDownload && (
            <ManagementButton
              disabled={disabled}
              label="下载全部媒体"
              onClick={onDownload}
            >
              <Download />
            </ManagementButton>
          )}
          {onEdit && (
            <ManagementButton
              disabled={disabled}
              label="编辑资源"
              onClick={onEdit}
            >
              <Pencil />
            </ManagementButton>
          )}
          {onRetryMetadata && (
            <ManagementButton
              disabled={disabled}
              label="重新获取 metadata"
              onClick={onRetryMetadata}
            >
              <RefreshCw />
            </ManagementButton>
          )}
          {onDelete && (
            <ManagementButton
              danger
              disabled={disabled}
              label="删除资源"
              onClick={onDelete}
            >
              <Trash2 />
            </ManagementButton>
          )}
          {onMove && (
            <ManagementButton
              disabled={disabled}
              label="移动资源"
              onClick={onMove}
            >
              <FolderInput />
            </ManagementButton>
          )}
        </div>
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
      className="mono h-5 rounded-none border-0 bg-transparent px-1.5 text-label text-[color:var(--andromeda-text-secondary)] hover:bg-transparent hover:text-[color:var(--andromeda-text-secondary)] [transform:none!important]"
      style={flatActionStyle}
      disabled={disabled}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick();
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
      <MessageSquare className="size-3" data-icon="inline-start" />
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
        <InputGroupButton className="mono text-[10px] active:translate-y-0" onClick={onCancel}>
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
      className={cn(actionButtonClass, danger && "text-destructive")}
      disabled={disabled}
      onClick={onClick}
      size="sm"
      title={label}
      type="button"
      variant="ghost"
      style={flatActionStyle}
    >
      {children}
    </Button>
  );
}

function ActionButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className={cn(actionButtonClass, active && "text-[color:var(--andromeda-accent-400)]")}
      disabled={disabled}
      onClick={onClick}
      size="sm"
      title={label}
      type="button"
      variant="ghost"
      style={flatActionStyle}
    >
      {children}
    </Button>
  );
}

function ResourceAnnotationPopover({
  commentDraft,
  disabled,
  onClear,
  onCommentDraftChange,
  onCommentSave,
  onRatingChange,
  rating,
}: {
  commentDraft: string;
  disabled: boolean;
  onClear: () => void;
  onCommentDraftChange: (value: string) => void;
  onCommentSave: () => void;
  onRatingChange: (rating: number) => void;
  rating: number;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label="编辑资源批注"
            className={actionButtonClass}
            disabled={disabled}
            size="sm"
            style={flatActionStyle}
            type="button"
            variant="ghost"
          >
            <MessageSquare />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        className="w-[280px] border-border bg-card p-3 text-foreground"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader>
          <PopoverTitle>资源批注</PopoverTitle>
          <PopoverDescription>
            给资源留一点判断和备注，之后回看会轻松很多。
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-2">
          <div>
            <div className="mono mb-1.5 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
              Rating
            </div>
            <ResourceCardRating
              ariaLabel="设置资源评分"
              onValueChange={onRatingChange}
              size={18}
              value={rating}
            />
          </div>
          <div>
            <div className="mono mb-1.5 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
              COMMENT
            </div>
            <Textarea
              className="min-h-20 resize-none text-xs leading-5"
              onChange={(event) => onCommentDraftChange(event.target.value)}
              placeholder="写下你的判断、提醒或下次要看的重点。"
              value={commentDraft}
            />
          </div>
        </div>
        <div className="flex justify-between gap-2">
          <Button onClick={onClear} size="sm" type="button" variant="ghost">
            清空
          </Button>
          <Button onClick={onCommentSave} size="sm" type="button">
            保存
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
    <div aria-label={ariaLabel} onClick={(event) => event.stopPropagation()}>
      <Rating
        className={cn(
          "h-5 items-center gap-0 text-destructive",
          !readOnly && "h-8 gap-0.5",
        )}
        onValueChange={(nextValue) =>
          onValueChange?.(nextValue === value ? 0 : nextValue)
        }
        readOnly={readOnly}
        value={value}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <RatingButton
            className={cn(
              "inline-flex items-center justify-center p-0 text-destructive focus-visible:ring-primary/35 focus-visible:ring-offset-0",
              readOnly ? "size-4 cursor-default" : "size-8 hover:bg-muted",
            )}
            icon={<Heart />}
            key={index}
            size={size}
          />
        ))}
      </Rating>
    </div>
  );
}
