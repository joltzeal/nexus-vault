import { createPortal } from "react-dom"
import { useId, type FormHTMLAttributes, type HTMLAttributes, type ReactNode } from "react"
import { X } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "./Card"
import { IconButton } from "./IconButton"

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode }) {
  if (typeof document === "undefined" || !open) return null
  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-background/75 px-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onOpenChange?.(false) }}>
      {children}
    </div>,
    document.body,
  )
}

export function DialogContent({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return <Card aria-modal="true" className={`relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-auto border-border bg-card text-foreground shadow-2xl ${className}`} role="dialog" {...props}>{children}</Card>
}

export function DialogHeader(props: HTMLAttributes<HTMLDivElement>) {
  return <CardHeader className={`items-start ${props.className ?? ""}`} {...props} />
}

export function DialogTitle({ children, className = "", ...props }: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode; className?: string }) {
  const id = useId()
  return <h2 className={`font-mono text-heading font-semibold text-foreground ${className}`} id={id} {...props}>{children}</h2>
}

export function DialogDescription({ children, className = "", ...props }: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode; className?: string }) {
  return <p className={`text-ui text-muted-foreground ${className}`} {...props}>{children}</p>
}

export function DialogBody({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return <CardContent className={`grid gap-4 ${className}`} {...props}>{children}</CardContent>
}

export function DialogFooter({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return <CardFooter className={`justify-end ${className}`} {...props}>{children}</CardFooter>
}

export function DialogClose({ onClick }: { onClick: () => void }) {
  return <IconButton aria-label="Close" icon={X} onClick={onClick} size="sm" variant="ghost" />
}

export type DialogFormProps = FormHTMLAttributes<HTMLFormElement>
