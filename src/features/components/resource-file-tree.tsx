import type { ReactNode } from "react"
import { File, FileAudio, FileImage, FileVideo } from "lucide-react"

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
import type { ResourceFileTreeNode } from "@/domain/resources/metadata"
import { formatBytes } from "@/features/formatters"

export function ResourceFileTree({
  className,
  tree,
}: {
  className?: string
  tree: ResourceFileTreeNode[]
}) {
  return (
    <TreeProvider
      animateExpand={false}
      className={className}
      indent={16}
      selectable={false}
      showLines
    >
      <TreeView className="p-1">
        {tree.map((node, index) => (
          <ResourceFileTreeItem
            isLast={index === tree.length - 1}
            key={`${index}:${node.name}`}
            level={0}
            node={node}
            nodeId={`${index}:${node.name}`}
          />
        ))}
      </TreeView>
    </TreeProvider>
  )
}

function ResourceFileTreeItem({
  isLast,
  level,
  node,
  nodeId,
  parentPath = [],
}: {
  isLast: boolean
  level: number
  node: ResourceFileTreeNode
  nodeId: string
  parentPath?: boolean[]
}) {
  const children = node.children ?? []
  const hasChildren = children.length > 0
  const isFolder = node.type === "folder" || hasChildren

  return (
    <TreeNode
      isLast={isLast}
      level={level}
      nodeId={nodeId}
      parentPath={parentPath}
    >
      <TreeNodeTrigger className="mx-0 gap-1 rounded-input px-2 py-1.5 text-xs hover:bg-ink-750">
        <TreeExpander hasChildren={hasChildren} />
        <TreeIcon
          className="mr-1 text-fg-dim"
          hasChildren={isFolder}
          icon={isFolder ? undefined : getFileIcon(node.type)}
        />
        <TreeLabel className="text-xs text-fg-muted" title={node.name}>
          {node.name}
        </TreeLabel>
        {typeof node.size === "number" && (
          <span className="mono ml-2 shrink-0 text-[10px] text-fg-faint">
            {formatBytes(node.size)}
          </span>
        )}
      </TreeNodeTrigger>
      <TreeNodeContent hasChildren={hasChildren}>
        {children.map((child, index) => (
          <ResourceFileTreeItem
            isLast={index === children.length - 1}
            key={`${index}:${child.name}`}
            level={level + 1}
            node={child}
            nodeId={`${nodeId}/${index}:${child.name}`}
            parentPath={[...parentPath, isLast]}
          />
        ))}
      </TreeNodeContent>
    </TreeNode>
  )
}

function getFileIcon(type: ResourceFileTreeNode["type"]): ReactNode {
  const className = "size-4"
  if (type === "video") return <FileVideo className={className} />
  if (type === "audio") return <FileAudio className={className} />
  if (type === "image") return <FileImage className={className} />
  return <File className={className} />
}
