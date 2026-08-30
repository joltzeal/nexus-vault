"use client"

import {
  TreeExpander,
  TreeIcon,
  TreeLabel,
  TreeNode,
  TreeNodeContent,
  TreeNodeTrigger,
  TreeProvider,
  TreeView,
} from "@/components/kibo-ui/tree"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type ResourceFileTreeNode = Record<string, unknown>

export function ResourceFileTree({
  className,
  nodes,
}: {
  className?: string
  nodes: ResourceFileTreeNode[]
}) {
  if (nodes.length === 0) {
    return (
      <div className={cn("px-3 py-4 text-label text-muted-foreground", className)}>
        No files available
      </div>
    )
  }

  return (
    <ScrollArea className={cn("max-h-[min(60vh,28rem)] overflow-hidden", className)}>
      <TreeProvider
        defaultExpandedIds={collectBranchIds(nodes)}
        showLines={false}
        selectable={false}
      >
        <TreeView className="p-1">
          {nodes.map((node, index) => (
            <ResourceFileTreeNodeItem
              isLast={index === nodes.length - 1}
              key={getNodeId(node, [index])}
              node={node}
              path={[index]}
            />
          ))}
        </TreeView>
      </TreeProvider>
    </ScrollArea>
  )
}

function ResourceFileTreeNodeItem({
  node,
  path,
  isLast,
}: {
  isLast: boolean
  node: ResourceFileTreeNode
  path: number[]
}) {
  const children = getChildren(node)
  const nodeId = getNodeId(node, path)
  const name = getNodeName(node, path[path.length - 1] ?? 0)
  const size = typeof node.size === "number" ? formatBytes(node.size) : null

  return (
    <TreeNode isLast={isLast} nodeId={nodeId} level={path.length - 1}>
      <TreeNodeTrigger className="mx-0 min-w-0 rounded-none px-2 py-1.5 hover:bg-muted">
        <TreeExpander hasChildren={children.length > 0} />
        <TreeIcon hasChildren={children.length > 0} />
        <TreeLabel className="min-w-0 text-label text-foreground">{name}</TreeLabel>
        {size && <span className="mono ml-auto shrink-0 text-[10px] text-muted-foreground">{size}</span>}
      </TreeNodeTrigger>
      <TreeNodeContent hasChildren={children.length > 0}>
        {children.map((child, index) => (
          <ResourceFileTreeNodeItem
            isLast={index === children.length - 1}
            key={getNodeId(child, [...path, index])}
            node={child}
            path={[...path, index]}
          />
        ))}
      </TreeNodeContent>
    </TreeNode>
  )
}

function getChildren(node: ResourceFileTreeNode) {
  return Array.isArray(node.children)
    ? node.children.filter(
        (child): child is ResourceFileTreeNode =>
          Boolean(child && typeof child === "object")
      )
    : []
}

function getNodeName(node: ResourceFileTreeNode, index: number) {
  if (typeof node.name === "string" && node.name.trim()) return node.name
  if (typeof node.path === "string" && node.path.trim()) return node.path
  return `Item ${index + 1}`
}

function getNodeId(node: ResourceFileTreeNode, path: number[]) {
  const identity = typeof node.path === "string" ? node.path : getNodeName(node, path[path.length - 1] ?? 0)
  return `resource-file:${path.join(".")}:${identity}`
}

function collectBranchIds(nodes: ResourceFileTreeNode[], parentPath: number[] = []): string[] {
  return nodes.flatMap((node, index) => {
    const path = [...parentPath, index]
    const children = getChildren(node)
    return children.length > 0
      ? [getNodeId(node, path), ...collectBranchIds(children, path)]
      : []
  })
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
