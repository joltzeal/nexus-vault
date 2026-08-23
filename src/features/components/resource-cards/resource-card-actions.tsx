"use client"

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
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { Rating, RatingButton } from "@/components/kibo-ui/rating"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type ResourceCardActionsProps = {
  comment?: string
  disabled?: boolean
  isChecked?: boolean
  isReadLater?: boolean
  isStarred?: boolean
  onClearAnnotation?: () => void
  onDelete?: () => void
  onDownload?: () => void
  onEdit?: () => void
  onMove?: () => void
  onRatingChange?: (rating: number) => void
  onRetryMetadata?: () => void
  onSaveComment?: (comment: string) => void
  onToggleChecked?: () => void
  onToggleReadLater?: () => void
  onToggleStar?: () => void
  rating?: number
  section?: "all" | "annotation" | "management"
}

export function ResourceCardActions({
  comment = "",
  disabled = false,
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
  const [commentDraft, setCommentDraft] = useState(comment)
  const hasAnnotationAction = Boolean(
    onClearAnnotation || onRatingChange || onSaveComment
  )
  const hasQuickActions = Boolean(
    hasAnnotationAction || onToggleReadLater || onToggleStar
  )
  const hasManagementActions = Boolean(
    onDownload || onEdit || onRetryMetadata || onMove || onDelete
  )
  const showAnnotationActions = section !== "management"
  const showManagementActions = section !== "annotation"

  useEffect(() => {
    setCommentDraft(comment)
  }, [comment])

  if (
    (!showAnnotationActions || (!hasQuickActions && !onToggleChecked)) &&
    (!showManagementActions || !hasManagementActions)
  ) return null

  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {showAnnotationActions && onToggleChecked && (
        <Checkbox
          aria-label={isChecked ? "标记为未处理" : "标记为已处理"}
          checked={isChecked}
          className="size-5 rounded-[5px] border border-line bg-ink-950 text-jade shadow-inner hover:border-line focus-visible:border-line focus-visible:ring-2 focus-visible:ring-jade/20 data-checked:border-line data-checked:bg-[var(--jade-glow)] data-checked:text-jade [&_[data-slot=checkbox-indicator]>svg]:size-3.5"
          disabled={disabled}
          onCheckedChange={() => onToggleChecked()}
        />
      )}

      {showAnnotationActions && hasQuickActions && (
        <ButtonGroup className="mono h-5 items-center rounded-md border border-line-soft bg-ink-850/55 px-1 text-[10px] text-fg-dim">
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
                setCommentDraft("")
                onClearAnnotation?.()
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
        </ButtonGroup>
      )}

      {showManagementActions && hasManagementActions && (
        <ButtonGroup className="h-5 items-center rounded-md border border-line-soft bg-ink-850/70 px-1">
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
        </ButtonGroup>
      )}
    </div>
  )
}

export function ResourceCardCommentButton({
  disabled = false,
  onClick,
}: {
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      className="mono h-5 px-1.5 text-[10px]"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      size="xs"
      type="button"
      variant="ghost"
    >
      <MessageSquare data-icon="inline-start" />
      Comment
    </Button>
  )
}

export function ResourceCardCommentEditor({
  onCancel,
  onChange,
  onSave,
  value,
}: {
  onCancel: () => void
  onChange: (value: string) => void
  onSave: () => void
  value: string
}) {
  return (
    <InputGroup className="min-h-20" onClick={(event) => event.stopPropagation()}>
      <InputGroupTextarea
        autoFocus
        className="mono text-[11px] leading-4"
        onChange={(event) => onChange(event.target.value)}
        placeholder="写下你的判断、提醒或下次要看的重点。"
        value={value}
      />
      <InputGroupAddon align="block-end" className="justify-end">
        <InputGroupButton className="mono text-[10px]" onClick={onCancel}>
          取消
        </InputGroupButton>
        <InputGroupButton className="mono text-[10px]" onClick={onSave} variant="default">
          保存
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

function ManagementButton({
  children,
  danger = false,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode
  danger?: boolean
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      aria-label={label}
      className={cn(
        "size-5 rounded-sm text-fg-dim hover:text-jade [&_svg]:size-3",
        danger && "hover:text-rose"
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
  )
}

function ActionButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  active: boolean
  children: ReactNode
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      aria-label={label}
      className={cn(
        "size-5 rounded-sm border border-transparent p-0 text-fg-dim hover:text-jade [&_svg]:size-3",
        active && "border-jade-dim bg-[var(--jade-glow)] text-jade"
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
  )
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
  commentDraft: string
  disabled: boolean
  onClear: () => void
  onCommentDraftChange: (value: string) => void
  onCommentSave: () => void
  onRatingChange: (rating: number) => void
  rating: number
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label="编辑资源批注"
            className="size-5 rounded-sm text-fg-dim hover:text-primary [&_svg]:size-3"
            disabled={disabled}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <MessageSquare />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        className="w-[280px] border-line bg-ink-850 p-3 text-fg"
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
            <div className="mono mb-1.5 text-[10px] uppercase tracking-[.12em] text-fg-faint">
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
            <div className="mono mb-1.5 text-[10px] uppercase tracking-[.12em] text-fg-faint">
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
          <Button onClick={onClear} size="xs" type="button" variant="ghost">
            清空
          </Button>
          <Button onClick={onCommentSave} size="xs" type="button">
            保存
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ResourceCardRating({
  ariaLabel,
  onValueChange,
  readOnly = false,
  size,
  value,
}: {
  ariaLabel: string
  onValueChange?: (value: number) => void
  readOnly?: boolean
  size: number
  value: number
}) {
  return (
    <div aria-label={ariaLabel} onClick={(event) => event.stopPropagation()}>
      <Rating
        className={cn(
          "h-5 items-center gap-0 text-rose",
          !readOnly && "h-8 gap-0.5"
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
              "inline-flex items-center justify-center p-0 text-rose focus-visible:ring-jade/35 focus-visible:ring-offset-0",
              readOnly
                ? "size-4 cursor-default rounded-sm"
                : "size-8 rounded-md hover:bg-ink-800"
            )}
            icon={<Heart />}
            key={index}
            size={size}
          />
        ))}
      </Rating>
    </div>
  )
}
