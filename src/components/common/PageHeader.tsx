import { Fragment, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { useDealerParam } from '@/app/useDealerParam'

export interface Crumb {
  label: string
  /** Omit for the current page or for a group label. */
  to?: string
}

interface PageHeaderProps {
  title: string
  /** One line under the title. */
  subtitle?: string
  /** Badges and labels under the title, instead of a subtitle. */
  meta?: ReactNode
  /** Browser tab title when it should differ from the page title (a long finding title). */
  documentTitle?: string
  breadcrumbs?: Crumb[]
  /** Buttons on the right. */
  actions?: ReactNode
}

/** Breadcrumbs, 20/28 semibold title, one-line subtitle, actions on the right. */
export function PageHeader({ title, subtitle, meta, documentTitle, breadcrumbs = [], actions }: PageHeaderProps) {
  const { search } = useDealerParam()

  const tabTitle = documentTitle ?? title
  useEffect(() => {
    document.title = `${tabTitle} · DealTrace`
  }, [tabTitle])

  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1">
        {breadcrumbs.length > 0 && (
          <Breadcrumb className="mb-1">
            <BreadcrumbList className="gap-1.5 text-xs leading-4 sm:gap-1.5">
              {breadcrumbs.map((crumb, i) => {
                const last = i === breadcrumbs.length - 1
                return (
                  <Fragment key={`${crumb.label}-${i}`}>
                    <BreadcrumbItem>
                      {last || !crumb.to ? (
                        last ? (
                          <BreadcrumbPage className="text-text-muted">{crumb.label}</BreadcrumbPage>
                        ) : (
                          <span>{crumb.label}</span>
                        )
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={{ pathname: crumb.to, search }}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!last && <BreadcrumbSeparator className="[&>svg]:size-3" />}
                  </Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <h1 className="text-xl leading-7 font-semibold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm leading-5 text-text-muted">{subtitle}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
