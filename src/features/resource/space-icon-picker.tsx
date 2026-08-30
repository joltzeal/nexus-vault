"use client"

import {
  Archive,
  BookOpen,
  Box,
  Briefcase,
  Clapperboard,
  Code2,
  Database,
  FileText,
  Folder,
  Gamepad2,
  Globe2,
  HardDrive,
  Image,
  Music,
  Palette,
  Sparkles,
  Tv,
} from "lucide-react"
import { createElement, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const spaceIcons = [
  { name: "tv", label: "媒体", Icon: Tv },
  { name: "folder", label: "文件夹", Icon: Folder },
  { name: "archive", label: "归档", Icon: Archive },
  { name: "book", label: "阅读", Icon: BookOpen },
  { name: "box", label: "集合", Icon: Box },
  { name: "briefcase", label: "工作", Icon: Briefcase },
  { name: "clapperboard", label: "影视", Icon: Clapperboard },
  { name: "code", label: "代码", Icon: Code2 },
  { name: "database", label: "数据", Icon: Database },
  { name: "file", label: "文档", Icon: FileText },
  { name: "game", label: "游戏", Icon: Gamepad2 },
  { name: "globe", label: "网页", Icon: Globe2 },
  { name: "drive", label: "网盘", Icon: HardDrive },
  { name: "image", label: "图片", Icon: Image },
  { name: "music", label: "音乐", Icon: Music },
  { name: "sparkles", label: "灵感", Icon: Sparkles },
] as const

export function SpaceIcon({
  className,
  name,
}: {
  className?: string
  name?: string
}) {
  const Icon = getSpaceIcon(name)

  return createElement(Icon, { className })
}

export function SpaceIconPicker({
  disabled,
  onSelect,
  triggerClassName,
  trigger = "current",
  value,
}: {
  disabled: boolean
  onSelect: (value: string) => void
  triggerClassName?: string
  trigger?: "current" | "action"
  value?: string
}) {
  const selected = value ?? "tv"
  const isActionTrigger = trigger === "action"
  const [open, setOpen] = useState(false)

  function selectIcon(name: string) {
    onSelect(name)
    setOpen(false)
  }

  const iconOptions = (
    <div className="grid grid-cols-4 gap-1">
      {spaceIcons.map(({ Icon, label, name }) => (
        <button
          className={cn(
            "flex h-12 flex-col items-center justify-center gap-1 rounded-input border border-transparent text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground",
            selected === name && "border-primary bg-primary/10 text-primary",
          )}
          disabled={disabled}
          key={name}
          onClick={() => selectIcon(name)}
          type="button"
        >
          <Icon className="size-4" />
          <span className="text-[10px]">{label}</span>
        </button>
      ))}
    </div>
  )

  if (disabled) {
    if (isActionTrigger) {
      return (
        <Button className={triggerClassName} size="icon-sm" variant="ghost" type="button" disabled>
          <Palette />
          <span className="sr-only">修改 Space 图标</span>
        </Button>
      )
    }

    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary [&_svg]:size-3.5">
        <SpaceIcon name={selected} />
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {isActionTrigger ? (
        <PopoverTrigger
          render={
          <Button className={triggerClassName} size="icon-sm" variant="ghost" type="button">
            <Palette />
            <span className="sr-only">修改 Space 图标</span>
          </Button>
          }
        />
      ) : (
        <PopoverTrigger
          render={
          <button
            className={cn(
              "inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary transition hover:bg-muted hover:text-primary [&_svg]:size-3.5",
              triggerClassName,
            )}
            type="button"
          >
            <SpaceIcon name={selected} />
            <span className="sr-only">选择 Space 图标</span>
          </button>
          }
        />
      )}
      <PopoverContent
        align="start"
        className="w-[252px] border-border bg-card p-2 text-foreground"
        positionerClassName="!z-[1100]"
      >
        {iconOptions}
      </PopoverContent>
    </Popover>
  )
}

function getSpaceIcon(name?: string) {
  return spaceIcons.find((item) => item.name === name)?.Icon ?? Tv
}
