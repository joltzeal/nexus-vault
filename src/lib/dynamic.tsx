import { createElement, lazy, Suspense } from "react"
import type { ComponentType } from "react"

type Loader<TProps> = () => Promise<
  | ComponentType<TProps>
  | {
      default: ComponentType<TProps>
    }
>

export function dynamic<TProps extends object>(
  loader: Loader<TProps>,
  _options?: { ssr?: boolean; loading?: ComponentType },
) {
  void _options
  const LazyComponent = lazy(async () => {
    const loaded = await loader()
    return typeof loaded === "function" ? { default: loaded } : loaded
  })

  return function DynamicComponent(props: TProps) {
    return (
      <Suspense fallback={null}>
        {createElement(LazyComponent as ComponentType<TProps>, props)}
      </Suspense>
    )
  }
}
